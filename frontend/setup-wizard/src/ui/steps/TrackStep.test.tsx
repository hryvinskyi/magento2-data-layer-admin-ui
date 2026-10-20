/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/preact';
import {
    Icon,
    PRODUCTS_STEP,
    requireStepId,
    type IconName,
    type PluginRegister,
} from '@hryvinskyi/datalayer-setup';
import type { WireCatalogueEvent, WirePageConfig } from '../../adapters/contract.ts';
import { LOCK_MESSAGE, multiWebsiteConfig, singleWebsiteConfig, withState } from '../../test/fixtures/page-config.ts';
import { renderStep } from '../../test/render-wizard.tsx';

afterEach(cleanup);

/** The phrases that carry values, spelled out so the numbers and names on screen can be asserted. */
const WORDING: Readonly<Record<string, string>> = {
    'track.sent': '%1 of %2 sent',
    'track.from_server.one': '%1 from the server',
    'track.from_server.other': '%1 from the server',
    'track.group.count': '%1 of %2',
    'preset.events.one': '%1 event',
    'preset.events.other': '%1 events',
    'preset.events_selected.one': '%1 event · selected',
    'preset.events_selected.other': '%1 events · selected',
    'warning.both': 'Counted twice: %1',
    'warning.server_off': 'Nothing delivers: %1',
    'action.go_to_step': 'Go to step %1',
    'step.sample.title': 'step.sample.title',
    'summary.track.one': '%2 · %1 event',
    'summary.track.other': '%2 · %1 events',
    'track.explain.inherited': 'Inherited from %1; locked for %2',
};

const worded = (base: WirePageConfig = multiWebsiteConfig): WirePageConfig => ({
    ...base,
    phrases: { ...base.phrases, ...WORDING },
});

const at = (scope: string, base: WirePageConfig = multiWebsiteConfig): WirePageConfig => ({ ...worded(base), initialScope: scope });

/** A plugin that delivers from the server (or not) and owns the step that sets it up. */
const delivery = (on: boolean): PluginRegister => (sdk) => {
    const stepId = requireStepId('sample');
    sdk.registerStep({ id: stepId, after: PRODUCTS_STEP, icon: 'dns', title: 'step.sample.title', component: () => null });
    sdk.registerServerDelivery({ stepId, isOn: () => on });
};

function openTrack(config: WirePageConfig = worded(), plugins: readonly PluginRegister[] = []) {
    return renderStep('track', config, { plugins });
}

const presetRadio = (name: string): HTMLInputElement => screen.getByRole<HTMLInputElement>('radio', { name });

const eventRow = (name: string): HTMLElement => {
    const row = screen.getByRole('cell', { name }).closest<HTMLElement>('[role="row"]');
    assert.ok(row, `a row for ${name}`);
    return row;
};

const sendSwitch = (name: string): HTMLButtonElement =>
    within(eventRow(name)).getByRole<HTMLButtonElement>('switch');

const channelSelect = (name: string): HTMLSelectElement =>
    within(eventRow(name)).getByRole<HTMLSelectElement>('combobox');

/** The track step's entry in the stepper. */
const trackEntry = (): HTMLElement =>
    within(screen.getByRole('navigation', { name: 'stepper.label' })).getByRole('button', { name: /step\.track\.title/ });

const summaryOf = (entry: HTMLElement): string | null =>
    entry.querySelector('.hdl-setup-step__summary')?.textContent ?? null;

const counters = (): string => screen.getByRole('status', { name: 'track.events' }).textContent ?? '';

/** The events table's head: its title and, while the selection can be changed here, where it comes from. */
const tableHead = (): HTMLElement => {
    const title = screen.getByRole('heading', { name: 'track.events' }).parentElement;
    assert.ok(title, 'the events title sits in the table head');
    return title;
};

/** Whether `first` comes before `second` in the document — what a person reading the step from the top meets first. */
const precedes = (first: Node, second: Node): boolean =>
    (first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

const firstPresetRadio = (): HTMLElement => {
    const first = within(screen.getByRole('radiogroup', { name: 'track.presets' })).getAllByRole('radio')[0];
    assert.ok(first, 'the presets offer a choice');
    return first;
};

const withCatalogue = (config: WirePageConfig, patch: (name: string) => Partial<WireCatalogueEvent>): WirePageConfig =>
    withState(config, {
        events: {
            ...config.state.events,
            catalogue: config.state.events.catalogue.map((event) => ({ ...event, ...patch(event.name) })),
        },
    });

describe('the preset cards', () => {
    it('offer each preset the server sent and select the one the selection equals', () => {
        openTrack();

        const group = screen.getByRole('radiogroup', { name: 'track.presets' });
        assert.deepEqual(within(group).getAllByRole('radio').map((radio) => radio.getAttribute('aria-labelledby')?.endsWith('-label')), [true, true]);
        assert.equal(presetRadio('preset.standard').checked, true);
        assert.equal(presetRadio('preset.minimal').checked, false);
        assert.ok(within(group).getByText('preset.standard.description'));
        assert.ok(within(group).getByText('9 events · selected'));
        assert.ok(within(group).getByText('2 events'));
    });

    it('show no custom card while a preset matches', () => {
        openTrack();

        assert.equal(screen.queryByRole('radio', { name: 'preset.custom' }), null);
    });

    it('draw the preset own glyph when the kit has it and a generic one otherwise', () => {
        openTrack();
        const drawn = (name: IconName): string | null => {
            const { container } = render(<Icon name={name} />);
            return container.querySelector('path')?.getAttribute('d') ?? null;
        };
        const tile = (preset: string): string | null =>
            presetRadio(preset).closest('label')?.querySelector('.hdl-setup-preset__tile path')?.getAttribute('d') ?? null;

        assert.equal(tile('preset.standard'), drawn('storefront'));
        assert.equal(tile('preset.minimal'), drawn('tune'));
    });

    it('apply a whole preset when chosen', () => {
        openTrack();

        fireEvent.click(presetRadio('preset.minimal'));

        assert.equal(presetRadio('preset.minimal').checked, true);
        assert.equal(presetRadio('preset.standard').checked, false);
        assert.match(counters(), /2 of 10 sent/);
        assert.equal(sendSwitch('view_item').getAttribute('aria-checked'), 'true');
        assert.equal(sendSwitch('purchase').getAttribute('aria-checked'), 'true');
        assert.equal(sendSwitch('view_cart').getAttribute('aria-checked'), 'false');
        assert.ok(screen.getByText('2 events · selected'));
    });

    it('add a selected, unchoosable custom card once a row differs from every preset', () => {
        openTrack();

        fireEvent.click(sendSwitch('view_item'));

        const custom = presetRadio('preset.custom');
        assert.equal(custom.checked, true);
        assert.equal(custom.getAttribute('aria-disabled'), 'true', 'it cannot be chosen');
        assert.equal(custom.disabled, false, 'but keyboard users still reach it');
        assert.equal(presetRadio('preset.standard').checked, false);
        assert.ok(screen.getByText('8 events · selected'));
        assert.ok(screen.getByText('preset.custom.description'));
    });

    it('move focus with the arrow keys without applying a preset, and apply the focused one with Space or Enter', () => {
        const wizard = openTrack();
        const standard = presetRadio('preset.standard');
        const minimal = presetRadio('preset.minimal');
        standard.focus();

        const moved = fireEvent.keyDown(standard, { key: 'ArrowRight' });
        assert.equal(moved, false, 'the platform does not choose the neighbour');
        assert.equal(document.activeElement, minimal);
        assert.equal(standard.checked, true, 'nothing applied yet');
        assert.equal(screen.queryByText('footer.unsaved.one'), null);

        fireEvent.keyDown(minimal, { key: 'ArrowLeft' });
        assert.equal(document.activeElement, standard);
        fireEvent.keyDown(standard, { key: 'ArrowLeft' });
        assert.equal(document.activeElement, minimal, 'it wraps around');

        fireEvent.keyDown(minimal, { key: 'Enter' });
        assert.equal(presetRadio('preset.minimal').checked, true);
        assert.ok(screen.getByText('footer.unsaved.one'));
        assert.deepEqual(wizard.logger.errors, []);
    });

    it('let the arrow keys reach the custom card, which Enter does not choose', () => {
        openTrack();
        fireEvent.click(sendSwitch('view_item'));
        const custom = presetRadio('preset.custom');
        const standard = presetRadio('preset.standard');
        standard.focus();

        fireEvent.keyDown(standard, { key: 'ArrowLeft' });
        assert.equal(document.activeElement, custom);
        fireEvent.keyDown(custom, { key: 'Enter' });
        assert.equal(presetRadio('preset.custom').checked, true);
        assert.equal(presetRadio('preset.standard').checked, false);
    });

    it('drop the custom card again when the selection matches a preset once more', () => {
        openTrack();

        fireEvent.click(sendSwitch('view_item'));
        fireEvent.click(sendSwitch('view_item'));

        assert.equal(screen.queryByRole('radio', { name: 'preset.custom' }), null);
        assert.equal(presetRadio('preset.standard').checked, true);
    });
});

describe('the events table', () => {
    it('lists the events by group, in catalogue order, with how many of each group are sent', () => {
        openTrack();

        const groups = screen.getAllByRole('rowheader');
        assert.deepEqual(groups.map((group) => group.textContent), ['group.browsing', 'group.cart', 'group.checkout', 'group.account']);
        const count = (group: string): string | undefined => {
            const row = screen.getByRole('rowheader', { name: group }).closest<HTMLElement>('[role="row"]');
            return row === null ? undefined : within(row).getByRole('cell').textContent ?? undefined;
        };
        assert.deepEqual(['group.browsing', 'group.cart', 'group.checkout', 'group.account'].map(count), ['4 of 4', '2 of 2', '2 of 3', '1 of 1']);

        const names = screen.getAllByRole('cell').filter((cell) => cell.classList.contains('hdl-setup-events__code')).map((cell) => cell.textContent);
        assert.deepEqual(names, [
            'view_item_list', 'select_item', 'view_item', 'view_promotion',
            'add_to_cart', 'view_cart',
            'begin_checkout', 'purchase', 'refund',
            'login',
        ]);
    });

    it('names each column and shows each event with its trigger and source', () => {
        openTrack();

        assert.deepEqual(
            screen.getAllByRole('columnheader').map((header) => header.textContent),
            ['track.column.event', 'track.column.trigger', 'track.column.source', 'track.column.send', 'track.column.channel'],
        );
        const row = eventRow('view_item');
        assert.ok(within(row).getByText('trigger.view_item'));
        assert.ok(within(row).getByText('source.page'));
    });

    it('counts what is sent and what the server sends', () => {
        openTrack();

        assert.match(counters(), /9 of 10 sent/);
        assert.match(counters(), /0 from the server/);
    });

    it('switches an event off and on, and keeps its channel disabled while it is off', () => {
        openTrack();

        assert.equal(channelSelect('view_item').disabled, false);
        fireEvent.click(sendSwitch('view_item'));

        assert.equal(sendSwitch('view_item').getAttribute('aria-checked'), 'false');
        assert.equal(channelSelect('view_item').disabled, true);
        assert.match(counters(), /8 of 10 sent/);
        assert.equal(eventRow('view_item').getAttribute('data-off'), 'true');

        fireEvent.click(sendSwitch('view_item'));
        assert.equal(channelSelect('view_item').disabled, false);
        assert.match(counters(), /9 of 10 sent/);
    });

    it('routes an event to the browser, the server or both', () => {
        openTrack();
        const select = channelSelect('purchase');

        assert.deepEqual(Array.from(select.options).map((option) => [option.value, option.textContent]), [
            ['browser', 'channel.browser'],
            ['server', 'channel.server'],
            ['both', 'channel.both'],
        ]);
        assert.equal(select.value, 'browser');

        fireEvent.change(select, { target: { value: 'server' } });

        assert.equal(channelSelect('purchase').value, 'server');
        assert.match(counters(), /1 from the server/);
        assert.equal(presetRadio('preset.custom').checked, true);
    });

    it('shows a fixed channel as a badge with its explanation instead of a choice', () => {
        openTrack();

        for (const [name, label] of [['view_promotion', 'channel.fixed.browser'], ['refund', 'channel.fixed.server']] as const) {
            const row = eventRow(name);
            const badge = within(row).getByText(label);
            assert.equal(badge.closest('.hdl-setup-badge')?.getAttribute('title'), `${label}.hint`);
            assert.equal(within(row).queryByRole('combobox'), null);
        }
    });

    it('shows an event that is always sent both ways as a fixed badge, counts it from the server and warns it is counted twice', () => {
        openTrack(worded(withCatalogue(multiWebsiteConfig, (name) => (name === 'login' ? { fixedChannel: 'both' } : {}))));

        const row = eventRow('login');
        assert.equal(within(row).getByText('channel.fixed.both').closest('.hdl-setup-badge')?.getAttribute('title'), 'channel.fixed.both.hint');
        assert.equal(within(row).queryByRole('combobox'), null);
        assert.match(counters(), /1 from the server/);
        assert.ok(screen.getByText('Counted twice: login'));
    });
});

describe('the warnings', () => {
    it('stay away while every event goes through the browser', () => {
        openTrack();

        assert.equal(screen.queryByRole('alert'), null);
    });

    it('warn that an event sent by both channels is counted twice, naming it', () => {
        openTrack();

        fireEvent.change(channelSelect('add_to_cart'), { target: { value: 'both' } });
        fireEvent.change(channelSelect('view_cart'), { target: { value: 'both' } });

        assert.ok(screen.getByText('Counted twice: add_to_cart and view_cart'));
    });

    it('warn that a server channel delivers nothing, offering no step to fix it when nothing contributes delivery', () => {
        openTrack();

        fireEvent.change(channelSelect('purchase'), { target: { value: 'server' } });

        assert.ok(screen.getByText('Nothing delivers: purchase'));
        assert.equal(screen.queryByRole('button', { name: /Go to step/ }), null);
    });

    it('offer the step that sets up server delivery when a contribution names one, and go there', () => {
        openTrack(worded(), [delivery(false)]);
        fireEvent.change(channelSelect('purchase'), { target: { value: 'server' } });

        fireEvent.click(screen.getByRole('button', { name: 'Go to step 5' }));

        assert.equal(screen.getByRole('heading', { level: 2 }).textContent, 'step.sample.title');
    });

    it('stay away when something delivers from the server', () => {
        openTrack(worded(), [delivery(true)]);

        fireEvent.change(channelSelect('purchase'), { target: { value: 'server' } });

        assert.equal(screen.queryByText(/Nothing delivers/), null);
        assert.equal(screen.queryByRole('button', { name: /Go to step/ }), null);
    });

    it('count a fixed server event that is switched on, and stop counting it once switched off', () => {
        openTrack();

        fireEvent.click(sendSwitch('refund'));
        assert.ok(screen.getByText('Nothing delivers: refund'));

        fireEvent.click(sendSwitch('refund'));
        assert.equal(screen.queryByText(/Nothing delivers/), null);
    });
});

describe('inheritance', () => {
    it('shows an inherited selection read-only until the scope overrides it', () => {
        openTrack(at('store:1'));

        assert.equal(sendSwitch('view_item').disabled, true);
        assert.equal(channelSelect('purchase').disabled, true);
        assert.equal(presetRadio('preset.minimal').disabled, true);
        assert.equal(screen.getByRole('table', { name: 'track.events' }).getAttribute('aria-disabled'), 'true');

        fireEvent.click(screen.getByRole('button', { name: 'action.override' }));

        assert.equal(sendSwitch('view_item').disabled, false);
        assert.equal(channelSelect('purchase').disabled, false);
        assert.equal(presetRadio('preset.minimal').disabled, false);
        assert.equal(screen.getByRole('table', { name: 'track.events' }).hasAttribute('aria-disabled'), false);
        fireEvent.click(presetRadio('preset.minimal'));
        assert.match(counters(), /2 of 10 sent/);
    });

    it('says why the step is read-only above the preset cards, with the override there', () => {
        openTrack(at('store:1'));

        const explanation = screen.getByText('Inherited from scope.default; locked for scope.main_en');
        const override = screen.getByRole('button', { name: 'action.override' });
        assert.ok(precedes(explanation, firstPresetRadio()), 'the explanation comes before the preset cards');
        assert.ok(precedes(override, firstPresetRadio()), 'the override comes before the preset cards');
        assert.equal(within(tableHead()).queryByRole('button'), null, 'the action is offered once, at the top');

        fireEvent.click(override);

        assert.equal(screen.queryByText(/^Inherited from/), null, 'nothing left to explain once the scope has its own');
        assert.ok(within(tableHead()).getByText('origin.store'));
    });

    it('names the built-in selection as the source when no scope above sets one', () => {
        openTrack(at('store:1', singleWebsiteConfig));

        assert.ok(screen.getByText('Inherited from origin.source.built_in; locked for scope.main_en'));
    });

    it('goes back to the inherited selection with the field action', () => {
        openTrack(at('store:1'));
        fireEvent.click(screen.getByRole('button', { name: 'action.override' }));
        fireEvent.click(presetRadio('preset.minimal'));

        fireEvent.click(screen.getByRole('button', { name: 'action.inherit' }));

        assert.match(counters(), /9 of 10 sent/);
        assert.equal(presetRadio('preset.standard').checked, true);
        assert.equal(sendSwitch('view_item').disabled, true);
    });

    it('shows what a scope with its own rows has stored, editable straight away', () => {
        openTrack(at('website:2'));

        assert.equal(presetRadio('preset.custom').checked, true);
        assert.equal(sendSwitch('login').getAttribute('aria-checked'), 'false');
        assert.equal(sendSwitch('login').disabled, false);
        assert.equal(channelSelect('purchase').value, 'both');
        assert.ok(screen.getByText('Counted twice: purchase'));
    });

    it('offers going back to the inherited selection in the table head, above the table', () => {
        openTrack(at('website:2'));

        const head = tableHead();
        assert.ok(within(head).getByText('origin.website'));
        const inherit = within(head).getByRole('button', { name: 'action.inherit' });
        assert.ok(precedes(inherit, screen.getByRole('table', { name: 'track.events' })));
        assert.equal(screen.queryByText(/^Inherited from/), null, 'an own selection needs no explanation');

        fireEvent.click(inherit);

        assert.equal(sendSwitch('login').disabled, true);
        assert.ok(screen.getByText('Inherited from scope.default; locked for scope.second'));
    });

    it('shows where the default selection applies in the table head, without an action', () => {
        openTrack();

        assert.ok(within(tableHead()).getByText('origin.overridden.one'));
        assert.equal(within(tableHead()).queryByRole('button'), null);
    });

    it('cannot be changed where the deployment fixes it, and says why above the preset cards', () => {
        const locked = withState(worded(), { events: { ...multiWebsiteConfig.state.events, locks: { default: LOCK_MESSAGE } } });
        openTrack(locked);

        assert.equal(sendSwitch('view_item').disabled, true);
        assert.equal(presetRadio('preset.minimal').disabled, true);
        assert.ok(precedes(screen.getByText(LOCK_MESSAGE), firstPresetRadio()), 'the lock message comes before the preset cards');
        assert.equal(screen.queryByRole('button', { name: 'action.override' }), null);
        assert.equal(screen.queryByRole('button', { name: 'action.inherit' }), null);
    });
});

describe('the step in the stepper', () => {
    it('sums up the preset the selection equals and how many events it sends, once the step was left', () => {
        openTrack();
        assert.equal(summaryOf(trackEntry()), null, 'nothing to sum up on first sight');

        fireEvent.click(screen.getByRole('button', { name: 'action.continue' }));

        assert.equal(summaryOf(trackEntry()), 'preset.standard · 9 events');
    });

    it('calls a selection that equals no preset Custom, with the singular for one event', () => {
        openTrack();
        fireEvent.click(presetRadio('preset.minimal'));
        fireEvent.click(sendSwitch('view_item'));
        fireEvent.click(screen.getByRole('button', { name: 'action.continue' }));

        assert.equal(summaryOf(trackEntry()), 'preset.custom · 1 event');
    });

    it('needs attention while events are counted twice, and no longer once they are not', () => {
        openTrack();
        assert.equal(trackEntry().textContent?.includes('step.status.current_attention'), false);

        fireEvent.change(channelSelect('add_to_cart'), { target: { value: 'both' } });
        assert.ok(trackEntry().textContent?.includes('step.status.current_attention'));

        fireEvent.change(channelSelect('add_to_cart'), { target: { value: 'browser' } });
        assert.equal(trackEntry().textContent?.includes('step.status.current_attention'), false);
    });

    it('needs attention while an event goes to the server and nothing delivers from there', () => {
        openTrack();
        fireEvent.change(channelSelect('purchase'), { target: { value: 'server' } });
        fireEvent.click(screen.getByRole('button', { name: 'action.continue' }));

        assert.ok(trackEntry().textContent?.includes('step.status.attention'));
    });

    it('needs no attention for a server channel when something delivers from the server', () => {
        openTrack(worded(), [delivery(true)]);
        fireEvent.change(channelSelect('purchase'), { target: { value: 'server' } });
        fireEvent.click(screen.getByRole('button', { name: 'action.continue' }));

        assert.ok(trackEntry().textContent?.includes('step.status.done'));
        assert.equal(trackEntry().textContent?.includes('step.status.attention'), false);
    });

    it('needs attention at a scope whose stored selection sends an event both ways, before anything is touched', () => {
        openTrack(at('website:2'));

        assert.ok(trackEntry().textContent?.includes('step.status.current_attention'));
    });
});
