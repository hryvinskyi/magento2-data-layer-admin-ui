/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { act, cleanup, fireEvent, screen, within } from '@testing-library/preact';
import type { JSX } from 'preact';
import {
    applyPreset,
    DEFAULT_SCOPE,
    PRODUCTS_STEP,
    RequestError,
    requireStepId,
    useWizard,
    type PluginRegister,
    type SaveResponse,
    type SaveResult,
    type WizardAction,
} from '@hryvinskyi/datalayer-setup';
import type { WirePageConfig } from '../../adapters/contract.ts';
import { settle } from '../../test/fakes.ts';
import { multiWebsiteConfig, withSetting } from '../../test/fixtures/page-config.ts';
import { key, scope, stateOf } from '../../test/fixtures/setup-state.ts';
import { renderStep, type RenderedWizard } from '../../test/render-wizard.tsx';

afterEach(cleanup);

const state = stateOf(multiWebsiteConfig);

/** The edits a person would make on other steps, as store actions. */
const setContainer = (at: string, value: string): WizardAction => ({ type: 'set', scope: scope(at), key: key('container_id'), value });
const setEnabled = (at: string, value: boolean): WizardAction => ({ type: 'set', scope: scope(at), key: key('enabled'), value });

/**
 * A stand-in for the steps before the review: a button per named list of store actions, so a test makes the same
 * edits a person makes in those steps and then moves on to the review.
 */
function probePlugin(lists: Readonly<Record<string, readonly WizardAction[]>>): PluginRegister {
    function ProbeStep(): JSX.Element {
        const { dispatch } = useWizard();
        return (
            <div>
                {Object.entries(lists).map(([name, actions]) => (
                    <button key={name} type="button" onClick={() => actions.forEach(dispatch)}>{name}</button>
                ))}
            </div>
        );
    }
    return (sdk) => {
        sdk.registerStep({
            id: requireStepId('probe'),
            after: PRODUCTS_STEP,
            icon: 'dns',
            title: 'step.probe.title',
            component: ProbeStep,
        });
    };
}

const withProbeTitle = (config: WirePageConfig): WirePageConfig => ({
    ...config,
    phrases: { ...config.phrases, 'step.probe.title': 'step.probe.title' },
});

/** Opens the wizard on the probe step, makes the named edits (all of them by default) and goes on to the review. */
function reviewAfter(
    lists: Readonly<Record<string, readonly WizardAction[]>>,
    config: WirePageConfig = multiWebsiteConfig,
    now: readonly string[] = Object.keys(lists),
): RenderedWizard {
    const wizard = renderStep('probe', withProbeTitle(config), { plugins: [probePlugin(lists)] });
    now.forEach((name) => fireEvent.click(screen.getByRole('button', { name })));
    fireEvent.click(screen.getByRole('button', { name: 'action.continue' }));
    assert.equal(screen.getByRole('heading', { level: 2 }).textContent, 'step.review.title');
    return wizard;
}

const table = (): HTMLElement => screen.getByRole('table', { name: 'review.changes' });

/** The rows that carry a change (not the header or a group heading). */
const changeRows = (): HTMLElement[] =>
    within(table()).getAllByRole('row').filter((row) => within(row).queryAllByRole('cell').length > 0);

const labelOf = (row: HTMLElement): string => within(row).getByRole('rowheader').textContent ?? '';

const saveAll = (): HTMLElement => screen.getByRole('button', { name: 'action.save_all' });

/** The snapshot the store holds after a save, built from the fixture with some rows replaced. */
const storedAfter = (patch: (config: WirePageConfig) => WirePageConfig) => stateOf(patch(multiWebsiteConfig));

const saved = (at: string, setting: string): SaveResult => ({ scope: scope(at), key: key(setting), status: 'saved' });

async function answer(wizard: RenderedWizard, index: number, response: SaveResponse): Promise<void> {
    await act(async () => {
        wizard.gateway.saves[index]?.answer.resolve(response);
        await settle();
    });
}

describe('the review step without changes', () => {
    it('says there is nothing to save', () => {
        renderStep('review');
        assert.ok(screen.getByRole('heading', { level: 3, name: 'review.nothing.title' }));
        assert.ok(screen.getByText('review.nothing.text'));
        assert.equal(screen.queryByRole('table') === null, true);
        assert.equal(saveAll().hasAttribute('disabled'), true);
    });
});

describe('the review step with changes', () => {
    it('lists each change against what is stored, with the scope it applies to', () => {
        reviewAfter({ edit: [setContainer('website:1', 'GTM-NEW1')] });

        const [row, ...others] = changeRows();
        assert.deepEqual(others, []);
        assert.ok(row);
        assert.equal(labelOf(row), 'container_id');
        const [current, next, scopeCell] = within(row).getAllByRole('cell');
        assert.equal(current?.textContent, 'GTM-AB12CD3origin.inherited', 'the value it takes now, and from where');
        assert.equal(next?.textContent, 'GTM-NEW1');
        assert.equal(scopeCell?.querySelector('.hdl-setup-badge')?.textContent, 'scope.main');
        assert.ok(within(row).getByRole('button', { name: 'review.discard_row' }), 'each pending change can be discarded');
        assert.deepEqual(['review.column.setting', 'review.column.current', 'review.column.new', 'scope.label'].map(
            (name) => within(table()).getByRole('columnheader', { name }).textContent,
        ), ['review.column.setting', 'review.column.current', 'review.column.new', 'scope.label']);
        assert.ok(screen.getByText('review.count'));
        assert.ok(screen.getByText('footer.unsaved.one'));
    });

    it('shows a scope that goes back to inheriting as "use inherited value" with what it will take', () => {
        reviewAfter({ edit: [{ type: 'inherit', scope: scope('website:2'), key: key('container_id') }] });

        const [row] = changeRows();
        assert.ok(row);
        const [current, next] = within(row).getAllByRole('cell');
        assert.equal(current?.textContent, 'GTM-WH45EF6');
        assert.equal(next?.textContent, 'action.inheritreview.inherited_value');
    });

    it('shows a secret as set, never as typed', () => {
        reviewAfter({ edit: [{ type: 'set', scope: scope('website:1'), key: key('sample_secret'), value: { replace: 'hunter2' } }] });

        assert.equal(within(table()).getAllByText('review.secret').length, 2, 'the stored secret and the new one are both masks');
        assert.equal((table().textContent ?? '').includes('hunter2'), false);
    });

    it('shows the events setting as its preset', () => {
        const minimal = state.events.presets.find((preset) => preset.key === 'minimal');
        assert.ok(minimal);
        const selection = applyPreset(state.events.catalogue, minimal);
        reviewAfter({ edit: [{ type: 'setEvents', scope: scope('website:1'), selection }] });

        const [row] = changeRows();
        assert.ok(row);
        assert.equal(labelOf(row), 'track.events');
        assert.equal(within(row).getAllByText('review.events').length, 2, 'the preset it has now and the one it gets');
    });

    it('groups the rows by the step that owns the setting, in step order, and leaves settings of an absent step last', () => {
        reviewAfter({
            edit: [
                { type: 'set', scope: DEFAULT_SCOPE, key: key('item_id'), value: 'entity_id' },
                { type: 'set', scope: scope('website:1'), key: key('sample_days'), value: '10' },
                setEnabled('default', false),
            ],
        });

        const groups = within(table()).getAllByRole('rowgroup');
        assert.deepEqual(groups.map((group) => group.getAttribute('aria-label')), ['review.group', 'review.group', 'review.group.other']);
        assert.deepEqual(
            groups.map((group) => within(group).getAllByRole('row').filter((row) => within(row).queryAllByRole('cell').length > 0).map(labelOf)),
            [['enabled'], ['item_id'], ['sample_days']],
        );
    });
});

describe('saving from the review step', () => {
    it('shows progress while the request is in flight, then what was saved at each scope', async () => {
        const wizard = reviewAfter({ edit: [setContainer('website:1', 'GTM-NEW1'), setEnabled('default', false)] });
        assert.equal(saveAll().hasAttribute('disabled'), false);

        fireEvent.click(saveAll());
        assert.equal(screen.getByRole('button', { name: 'action.saving' }).getAttribute('aria-busy'), 'true');
        assert.equal(table().getAttribute('aria-disabled'), 'true');
        assert.deepEqual(wizard.gateway.saves[0]?.input, {
            changes: [
                { scope: 'default', key: 'enabled', op: 'set', value: false },
                { scope: 'website:1', key: 'container_id', op: 'set', value: 'GTM-NEW1' },
            ],
        });

        await answer(wizard, 0, {
            results: [saved('default', 'enabled'), saved('website:1', 'container_id')],
            state: storedAfter((config) => withSetting(withSetting(config, 'enabled', { values: { default: false } }), 'container_id', {
                values: { default: 'GTM-AB12CD3', 'website:1': 'GTM-NEW1', 'website:2': 'GTM-WH45EF6' },
            })),
        });

        assert.ok(screen.getByRole('heading', { level: 3, name: 'success.count.other' }));
        assert.ok(screen.getByText('success.text'));
        assert.equal(screen.queryByRole('table') === null, true);
        assert.ok(screen.getByText('footer.all_saved'));
        const scopeNames = screen.getAllByText(/^(field\.reach\.default|scope\.main)$/).map((node) => node.textContent);
        assert.deepEqual(scopeNames, ['field.reach.default', 'scope.main']);
        assert.ok(screen.getByText('enabled'));
        assert.ok(screen.getByText('switch.no'));
        assert.ok(screen.getByText('container_id'));
        assert.ok(screen.getByText(/GTM-NEW1/));
    });

    it('offers GTM Preview in a new tab and the advanced settings of the current scope', async () => {
        const wizard = reviewAfter({ edit: [setEnabled('default', false)] });
        fireEvent.click(saveAll());
        await answer(wizard, 0, {
            results: [saved('default', 'enabled')],
            state: storedAfter((config) => withSetting(config, 'enabled', { values: { default: false } })),
        });

        const preview = screen.getByRole('link', { name: 'checklist.open_preview' });
        assert.equal(preview.getAttribute('href'), 'https://tagassistant.google.com/');
        assert.equal(preview.getAttribute('target'), '_blank');
        assert.match(preview.getAttribute('rel') ?? '', /noopener/);
        const advanced = screen.getAllByRole('link', { name: 'action.advanced' });
        assert.equal(advanced.length, 2, 'the page header and the success panel');
        assert.deepEqual(advanced.map((link) => link.getAttribute('href')), [
            'https://admin.test/advanced/default/',
            'https://admin.test/advanced/default/',
        ]);
    });

    it('links to the advanced settings of the scope being edited', async () => {
        const wizard = reviewAfter({ edit: [setContainer('website:2', 'GTM-NEW2')] }, { ...multiWebsiteConfig, initialScope: 'website:2' });
        fireEvent.click(saveAll());
        await answer(wizard, 0, {
            results: [saved('website:2', 'container_id')],
            state: storedAfter((config) => withSetting(config, 'container_id', { values: { default: 'GTM-AB12CD3', 'website:2': 'GTM-NEW2' } })),
        });

        const hrefs = screen.getAllByRole('link', { name: 'action.advanced' }).map((link) => link.getAttribute('href'));
        assert.deepEqual(hrefs, ['https://admin.test/advanced/website/2/', 'https://admin.test/advanced/website/2/']);
    });

    it('lists the events sent at the default scope in the checklist, and lets each item be ticked off', async () => {
        const wizard = reviewAfter({ edit: [setEnabled('default', false)] });
        fireEvent.click(saveAll());
        await answer(wizard, 0, {
            results: [saved('default', 'enabled')],
            state: storedAfter((config) => withSetting(config, 'enabled', { values: { default: false } })),
        });

        assert.ok(screen.getByRole('heading', { level: 3, name: 'checklist.title' }));
        const boxes = screen.getAllByRole<HTMLInputElement>('checkbox');
        assert.deepEqual(boxes.map((box) => box.getAttribute('aria-labelledby') !== null), [true, true, true]);
        assert.ok(screen.getByRole('checkbox', { name: 'checklist.tags.other' }));
        assert.ok(screen.getByRole('checkbox', { name: 'checklist.preview' }));
        assert.ok(screen.getByRole('checkbox', { name: 'checklist.publish' }));
        for (const name of ['view_item_list', 'purchase', 'login']) {
            assert.ok(screen.getByText(name));
        }
        assert.equal(screen.queryByText('refund') === null, true, 'an event that is switched off needs no tag');

        const preview = screen.getByRole<HTMLInputElement>('checkbox', { name: 'checklist.preview' });
        assert.equal(preview.checked, false);
        fireEvent.click(preview);
        assert.equal(screen.getByRole<HTMLInputElement>('checkbox', { name: 'checklist.preview' }).checked, true);
        assert.equal(screen.getByRole<HTMLInputElement>('checkbox', { name: 'checklist.publish' }).checked, false);
    });

    it('marks each row after a save that stored only some changes, and keeps Save all available', async () => {
        const wizard = reviewAfter({ edit: [setContainer('website:1', 'GTM-BAD'), setEnabled('default', false)] });
        fireEvent.click(saveAll());
        await answer(wizard, 0, {
            results: [
                saved('default', 'enabled'),
                { scope: scope('website:1'), key: key('container_id'), status: 'failed', message: 'not a container' },
            ],
            state: storedAfter((config) => withSetting(config, 'enabled', { values: { default: false } })),
        });

        assert.equal(screen.getByRole('alert').textContent, 'save.partial');
        const [enabled, container, ...others] = changeRows();
        assert.deepEqual(others, []);
        assert.ok(enabled && container);
        assert.equal(labelOf(enabled), 'enabled');
        assert.ok(within(enabled).getByText('review.saved'));
        assert.equal(enabled.hasAttribute('data-result'), false);
        assert.equal(labelOf(container), 'container_id');
        assert.ok(within(container).getByText('not a container'));
        assert.equal(container.getAttribute('data-result'), 'failed');

        assert.ok(screen.getByText('footer.unsaved.one'), 'the footer counts what is still unsaved');
        assert.equal(saveAll().hasAttribute('disabled'), false);
    });

    it('sends only the changes that failed when Save all is clicked again, and finishes with the success panel', async () => {
        const wizard = reviewAfter({ edit: [setContainer('website:1', 'GTM-BAD'), setEnabled('default', false)] });
        fireEvent.click(saveAll());
        await answer(wizard, 0, {
            results: [
                saved('default', 'enabled'),
                { scope: scope('website:1'), key: key('container_id'), status: 'failed', message: 'not a container' },
            ],
            state: storedAfter((config) => withSetting(config, 'enabled', { values: { default: false } })),
        });

        fireEvent.click(saveAll());
        assert.deepEqual(wizard.gateway.saves[1]?.input, {
            changes: [{ scope: 'website:1', key: 'container_id', op: 'set', value: 'GTM-BAD' }],
        });
        assert.equal(screen.queryByRole('alert') === null, true, 'the strip about the earlier save is gone');
        assert.equal(within(table()).queryByText('review.saved') === null, true);

        await answer(wizard, 1, {
            results: [saved('website:1', 'container_id')],
            state: storedAfter((config) => withSetting(withSetting(config, 'enabled', { values: { default: false } }), 'container_id', {
                values: { default: 'GTM-AB12CD3', 'website:1': 'GTM-BAD', 'website:2': 'GTM-WH45EF6' },
            })),
        });
        assert.ok(screen.getByRole('heading', { level: 3, name: 'success.count.one' }));
    });

    it('keeps the table as it was when the whole request fails', async () => {
        const wizard = reviewAfter({ edit: [setContainer('website:1', 'GTM-NEW1')] });
        fireEvent.click(saveAll());
        await act(async () => {
            wizard.gateway.saves[0]?.answer.reject(new RequestError('network'));
            await settle();
        });

        assert.equal(screen.getByRole('alert').textContent, 'request.network', 'the frame says what went wrong');
        assert.equal(changeRows().length, 1);
        assert.equal(table().hasAttribute('aria-disabled'), false);
        assert.equal(within(table()).queryByText('review.saved') === null, true);
        assert.equal(saveAll().hasAttribute('disabled'), false);
    });

    it('lists new changes made after a save instead of the success panel', async () => {
        const wizard = reviewAfter(
            { first: [setEnabled('default', false)], second: [setContainer('website:1', 'GTM-NEW9')] },
            multiWebsiteConfig,
            ['first'],
        );
        fireEvent.click(saveAll());
        await answer(wizard, 0, {
            results: [saved('default', 'enabled')],
            state: storedAfter((config) => withSetting(config, 'enabled', { values: { default: false } })),
        });
        assert.ok(screen.getByText('success.text'));

        const stepper = (): HTMLElement => screen.getByRole('navigation', { name: 'stepper.label' });
        fireEvent.click(within(stepper()).getByRole('button', { name: /step\.probe\.title/ }));
        fireEvent.click(screen.getByRole('button', { name: 'second' }));
        fireEvent.click(within(stepper()).getByRole('button', { name: /step\.review\.title/ }));

        assert.equal(screen.queryByText('success.text') === null, true);
        assert.deepEqual(changeRows().map(labelOf), ['container_id']);
        assert.deepEqual(wizard.logger.errors, []);
    });
});

describe('discarding from the review step', () => {
    it('drops one pending change, leaving the others', () => {
        const wizard = reviewAfter({ edit: [setContainer('website:1', 'GTM-NEW1'), setEnabled('default', false)] });
        assert.deepEqual(changeRows().map(labelOf), ['enabled', 'container_id']);

        const [, containerRow] = changeRows();
        assert.ok(containerRow);
        fireEvent.click(within(containerRow).getByRole('button', { name: 'review.discard_row' }));

        assert.deepEqual(changeRows().map(labelOf), ['enabled']);
        assert.ok(screen.getByText('footer.unsaved.one'));
        assert.equal(wizard.gateway.saves.length, 0, 'nothing is sent');
    });

    it('drops every pending change once the person confirms, and keeps them when they do not', () => {
        reviewAfter({ edit: [setContainer('website:1', 'GTM-NEW1'), setEnabled('default', false)] });

        fireEvent.click(screen.getByRole('button', { name: 'review.discard_all' }));
        fireEvent.click(screen.getByRole('button', { name: 'review.discard_all.no' }));
        assert.equal(changeRows().length, 2, 'kept');

        fireEvent.click(screen.getByRole('button', { name: 'review.discard_all' }));
        assert.ok(screen.getByRole('group', { name: 'review.discard_all.confirm' }));
        fireEvent.click(screen.getByRole('button', { name: 'review.discard_all.yes' }));

        assert.ok(screen.getByRole('heading', { level: 3, name: 'review.nothing.title' }));
        assert.ok(screen.getByText('footer.none'));
    });
});

describe('Save all while a step has problems', () => {
    it('waits while a step has problems at a scope it would write, and leads to that step at that scope', () => {
        const wizard = reviewAfter({ edit: [setContainer('website:1', 'GTM bad id')] });

        assert.equal(saveAll().hasAttribute('disabled'), true);
        const strip = screen.getByRole('alert');
        assert.ok(within(strip).getByText('review.blocked'));
        assert.ok(within(strip).getByText('review.blocked.item'));
        fireEvent.click(saveAll());
        assert.equal(wizard.gateway.saves.length, 0);

        fireEvent.click(within(strip).getByRole('button', { name: 'action.go_to_step' }));
        assert.equal(screen.getByRole('heading', { level: 2 }).textContent, 'step.connect.title');
        assert.equal(screen.getByRole<HTMLSelectElement>('combobox', { name: 'scope.label' }).value, 'website:1');
    });

    it('saves once the problem is fixed', () => {
        const wizard = reviewAfter({ broken: [setContainer('website:1', 'GTM bad id')], fixed: [setContainer('website:1', 'GTM-GOOD1')] }, multiWebsiteConfig, ['broken']);
        assert.equal(saveAll().hasAttribute('disabled'), true);

        const stepper = (): HTMLElement => screen.getByRole('navigation', { name: 'stepper.label' });
        fireEvent.click(within(stepper()).getByRole('button', { name: /step\.probe\.title/ }));
        fireEvent.click(screen.getByRole('button', { name: 'fixed' }));
        fireEvent.click(within(stepper()).getByRole('button', { name: /step\.review\.title/ }));

        assert.equal(screen.queryByText('review.blocked') === null, true);
        fireEvent.click(saveAll());
        assert.equal(wizard.gateway.saves.length, 1);
    });
});

describe('the wizard while a save is in flight', () => {
    it('cannot be edited or moved until the save settles', async () => {
        const wizard = reviewAfter({ edit: [setContainer('website:1', 'GTM-NEW1'), setEnabled('default', false)] });
        fireEvent.click(saveAll());

        const frame = document.querySelector('.hdl-setup-frame');
        assert.equal(frame?.getAttribute('aria-busy'), 'true');
        const section = table().closest('section');
        assert.ok(section?.hasAttribute('inert'), 'the step is out of reach');
        assert.equal(screen.getByRole('combobox', { name: 'scope.label' }).hasAttribute('disabled'), true);
        const steps = within(screen.getByRole('navigation', { name: 'stepper.label' })).getAllByRole('button');
        assert.ok(steps.every((button) => button.hasAttribute('disabled')));
        assert.equal(screen.getByRole('button', { name: 'action.back' }).hasAttribute('disabled'), true);

        const [row] = changeRows();
        assert.ok(row);
        fireEvent.click(within(row).getByRole('button', { name: 'review.discard_row' }));
        fireEvent.click(steps[0] ?? document.body);
        assert.equal(changeRows().length, 2, 'what was sent is what is shown');
        assert.equal(screen.getByRole('heading', { level: 2 }).textContent, 'step.review.title');

        await act(async () => {
            wizard.gateway.saves[0]?.answer.reject(new RequestError('network'));
            await settle();
        });
        assert.equal(frame?.hasAttribute('aria-busy'), false);
        assert.equal(table().closest('section')?.hasAttribute('inert'), false);
        assert.equal(screen.getByRole('combobox', { name: 'scope.label' }).hasAttribute('disabled'), false);
        fireEvent.click(within(changeRows()[0] ?? document.body).getByRole('button', { name: 'review.discard_row' }));
        assert.equal(changeRows().length, 1, 'editable again');
    });
});
