/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ContractError } from '../adapters/contract.ts';
import { changes } from '../domain/diff.ts';
import { createDraft, ownAt, setValue, type Draft } from '../domain/draft.ts';
import type { ScopeId } from '../domain/scope.ts';
import type { EditValue, SettingKey } from '../domain/setting.ts';
import { recordingGateway, settle } from '../test/fakes.ts';
import { multiWebsiteConfig, withSetting } from '../test/fixtures/page-config.ts';
import { key, scope, stateOf } from '../test/fixtures/setup-state.ts';
import { RequestError } from './request-error.ts';
import type { SaveResponse } from './responses.ts';
import { saveAll, settleSave } from './save-all.ts';

const stored = stateOf(multiWebsiteConfig);

function edit(draft: Draft, at: ScopeId, setting: SettingKey, value: EditValue): Draft {
    const result = setValue(draft, at, setting, value);
    assert.ok(result.ok, `the fixture accepts ${setting} at ${at}`);
    return result.value;
}

/** Two pending changes: a measurement ID at the default scope, a container ID at the main website. */
const pending = edit(
    edit(createDraft(stored), scope('default'), key('measurement_id'), 'g-abc1'),
    scope('website:1'),
    key('container_id'),
    'GTM-NEW1',
);

/** The server stores the measurement ID upper-cased and refuses the container ID. */
const partlySaved: SaveResponse = {
    results: [
        { scope: scope('default'), key: key('measurement_id'), status: 'saved' },
        { scope: scope('website:1'), key: key('container_id'), status: 'failed', message: 'refused.container' },
    ],
    state: stateOf(withSetting(multiWebsiteConfig, 'measurement_id', { values: { default: 'G-ABC1' } })),
};

describe('saveAll', () => {
    it('sends every pending change in one request', async () => {
        const gateway = recordingGateway();
        const saving = saveAll(gateway)(pending, new AbortController().signal);
        await settle();

        assert.equal(gateway.saves.length, 1);
        assert.deepEqual(gateway.saves[0]?.input, {
            changes: [
                { scope: 'default', key: 'measurement_id', op: 'set', value: 'g-abc1' },
                { scope: 'website:1', key: 'container_id', op: 'set', value: 'GTM-NEW1' },
            ],
        });
        gateway.saves[0]?.answer.resolve(partlySaved);
        assert.equal((await saving).kind, 'completed');
    });

    it('takes the stored values from the answer and keeps only the failed changes as edits', async () => {
        const gateway = recordingGateway();
        const saving = saveAll(gateway)(pending, new AbortController().signal);
        await settle();
        gateway.saves[0]?.answer.resolve(partlySaved);
        const outcome = await saving;

        assert.equal(outcome.kind, 'completed');
        if (outcome.kind !== 'completed') {
            return;
        }
        assert.equal(outcome.draft.state, partlySaved.state);
        assert.equal(ownAt(outcome.draft, scope('default'), key('measurement_id')), 'G-ABC1', 'what the store holds, not what was sent');
        assert.deepEqual(
            changes(outcome.draft).map((change) => [change.scope, change.key]),
            [['website:1', 'container_id']],
        );
        assert.deepEqual(outcome.results, partlySaved.results);
    });

    for (const kind of ['expired', 'timeout', 'network', 'server'] as const) {
        it(`keeps every edit when the request fails as a whole (${kind})`, async () => {
            const gateway = recordingGateway();
            const saving = saveAll(gateway)(pending, new AbortController().signal);
            await settle();
            gateway.saves[0]?.answer.reject(new RequestError(kind));
            const outcome = await saving;

            assert.equal(outcome.kind, 'failed');
            assert.deepEqual(outcome.kind === 'failed' ? outcome.failure : null, { kind, serverMessage: null });
            assert.equal(changes(pending).length, 2, 'the draft it was given is untouched');
        });
    }

    it('reports an answer of the wrong shape as a server failure and keeps its cause for the log', async () => {
        const gateway = recordingGateway();
        const saving = saveAll(gateway)(pending, new AbortController().signal);
        await settle();
        const cause = new ContractError('$.state', 'an object');
        gateway.saves[0]?.answer.reject(cause);
        const outcome = await saving;

        assert.deepEqual(outcome.kind === 'failed' ? [outcome.failure.kind, outcome.cause] : null, ['server', cause]);
    });

    it('reports an aborted save as aborted, not as a failure', async () => {
        const gateway = recordingGateway();
        const controller = new AbortController();
        const saving = saveAll(gateway)(pending, controller.signal);
        await settle();
        controller.abort();
        gateway.saves[0]?.answer.reject(controller.signal.reason);

        assert.deepEqual(await saving, { kind: 'aborted' });
    });

    it('sends nothing when nothing is pending', async () => {
        const gateway = recordingGateway();

        assert.deepEqual(await saveAll(gateway)(createDraft(stored), new AbortController().signal), { kind: 'unchanged' });
        assert.equal(gateway.saves.length, 0);
    });
});

describe('settleSave', () => {
    it('keeps an edit made while the save was in flight, even of a saved setting', () => {
        const typedLater = edit(pending, scope('default'), key('measurement_id'), 'G-XYZ9');
        const settled = settleSave(typedLater, pending, partlySaved);

        assert.equal(ownAt(settled, scope('default'), key('measurement_id')), 'G-XYZ9');
        assert.deepEqual(
            changes(settled).map((change) => [change.scope, change.key]),
            [['default', 'measurement_id'], ['website:1', 'container_id']],
        );
    });

    it('keeps a sent change the answer does not report as saved', () => {
        const settled = settleSave(pending, pending, { results: [], state: partlySaved.state });

        assert.equal(changes(settled).length, 2);
    });
});
