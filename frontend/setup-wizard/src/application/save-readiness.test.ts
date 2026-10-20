/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createDraft, setValue, type Draft } from '../domain/draft.ts';
import { createRequirementRegistry, registerCoreRequirements, stepIssues } from '../domain/validation.ts';
import type { SettingsView } from '../domain/view.ts';
import { multiWebsiteConfig } from '../test/fixtures/page-config.ts';
import { key, scope, stateOf, step } from '../test/fixtures/setup-state.ts';
import { saveBlockers, type StepCheck } from './save-readiness.ts';

const registry = createRequirementRegistry();
registerCoreRequirements(registry);

const checkOf = (id: string): StepCheck => ({
    id: step(id),
    issuesAt: (view: SettingsView) => stepIssues(step(id), view, registry),
});
const STEPS = [checkOf('connect'), checkOf('products'), checkOf('sample')];

function edit(draft: Draft, at: string, name: string, value: string | boolean): Draft {
    const result = setValue(draft, scope(at), key(name), value);
    assert.ok(result.ok, `${name} at ${at}`);
    return result.value;
}

describe('save readiness', () => {
    const draft = createDraft(stateOf(multiWebsiteConfig));

    it('lets a clean draft through', () => {
        assert.deepEqual(saveBlockers(draft, STEPS), []);
        assert.deepEqual(saveBlockers(edit(draft, 'website:2', 'sample_days', '60'), STEPS), []);
    });

    it('names each step with issues at a scope with pending changes, with that scope', () => {
        const broken = edit(edit(draft, 'website:2', 'sample_days', '9999'), 'default', 'container_id', 'nope');
        assert.deepEqual(saveBlockers(broken, STEPS), [
            { step: step('connect'), scope: scope('default'), issues: [{ key: key('container_id'), code: 'format' }] },
            { step: step('sample'), scope: scope('website:2'), issues: [{ key: key('sample_days'), code: 'range' }] },
        ]);
    });

    it('does not check a scope the save would not write', () => {
        const brokenElsewhere = edit(draft, 'website:2', 'sample_days', '9999');
        const blockers = saveBlockers(edit(brokenElsewhere, 'store:1', 'brand', 'manufacturer'), STEPS);
        assert.deepEqual(blockers.map((blocker) => blocker.scope), [scope('website:2')]);
    });
});
