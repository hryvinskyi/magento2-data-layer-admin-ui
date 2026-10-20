/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { cleanup, fireEvent, screen, within } from '@testing-library/preact';
import { multiWebsiteConfig, singleWebsiteConfig, withSetting } from '../../test/fixtures/page-config.ts';
import { renderStep, renderWizard } from '../../test/render-wizard.tsx';

afterEach(cleanup);

const heading = (): string => screen.getByRole('heading', { level: 2 }).textContent ?? '';
const radio = (name: string): HTMLInputElement => screen.getByRole<HTMLInputElement>('radio', { name });
const scopeBar = (): HTMLSelectElement => screen.getByRole<HTMLSelectElement>('combobox', { name: 'scope.label' });

/** The labelled row of a scope's card: what it says about the scope. */
function cardOf(name: string): HTMLElement {
    const row = radio(name).closest('label');
    assert.ok(row !== null, `${name} sits in a labelled card`);
    return row;
}

describe('the scope step', () => {
    it('offers the default scope, each website and the store views under it as one group', () => {
        renderStep('scope', multiWebsiteConfig);
        const group = screen.getByRole('radiogroup', { name: 'scope.cards.label' });
        const names = within(group).getAllByRole('radio').map((input) => input.getAttribute('aria-label'));
        assert.deepEqual(names, ['scope.default', 'scope.main', 'scope.main_en', 'scope.main_fr', 'scope.second', 'scope.second_en']);
        assert.equal(radio('scope.default').checked, true);
        assert.equal(radio('scope.main').checked, false);
        assert.equal(screen.queryByText('scope.single_website') === null, true, 'a shop with several websites has no single-website strip');
        assert.equal(screen.queryByRole('button', { name: 'scope.skip_to_connect' }) === null, true);
    });

    it('shows whether tracking is on, the container, and where it applies', () => {
        renderStep('scope', multiWebsiteConfig);
        const root = within(cardOf('scope.default'));
        assert.ok(root.getByText('scope.default.sub'));
        assert.ok(root.getByText('scope.tracking.on'));
        assert.ok(root.getByText('GTM-AB12CD3'));
        assert.equal(root.queryByText('scope.uses_default') === null, true, 'the default scope does not inherit');

        const main = within(cardOf('scope.main'));
        assert.ok(main.getByText('scope.website.sub.other'), 'two store views');
        const second = within(cardOf('scope.second'));
        assert.ok(second.getByText('scope.website.sub.one'), 'one store view');
        assert.ok(second.getByText('GTM-WH45EF6'));
    });

    it('marks every setting a website overrides, and says when it overrides none', () => {
        renderStep('scope', withSetting(multiWebsiteConfig, 'hidden_price', { values: {}, locks: {} }));
        const second = within(cardOf('scope.second'));
        for (const label of ['container_id', 'brand', 'sample_days', 'track.events']) {
            assert.ok(second.getByText(label), `${label} is marked as overridden`);
        }
        assert.equal(second.queryByText('scope.uses_default') === null, true);

        const main = within(cardOf('scope.main'));
        assert.ok(main.getByText('scope.uses_default'));
        assert.equal(main.queryByText('hidden_price') === null, true);
    });

    it('shows a store view with its own overrides, or what it inherits from', () => {
        renderStep('scope', multiWebsiteConfig);
        const overriding = within(cardOf('scope.main_en'));
        assert.ok(overriding.getByText('item_id'));
        assert.equal(overriding.queryByText('scope.inherits_from') === null, true);
        assert.ok(overriding.getByText('scope.store.kind'));

        assert.ok(within(cardOf('scope.main_fr')).getByText('scope.inherits_from'));
    });

    it('chooses the scope the wizard edits, as the scope bar does', () => {
        renderStep('scope', multiWebsiteConfig);
        fireEvent.click(radio('scope.second'));
        assert.equal(scopeBar().value, 'website:2');
        assert.equal(radio('scope.second').checked, true);
        assert.equal(radio('scope.default').checked, false);
        assert.ok(screen.getByText('scope.website.applies'));

        fireEvent.click(radio('scope.main_en'));
        assert.equal(scopeBar().value, 'store:1');
        assert.equal(radio('scope.main_en').checked, true);

        fireEvent.change(scopeBar(), { target: { value: 'default' } });
        assert.equal(radio('scope.default').checked, true, 'the cards follow the scope bar');
    });

    it('shows the edits made in other steps on the cards', () => {
        renderWizard(multiWebsiteConfig);
        fireEvent.click(screen.getByRole('button', { name: /step\.connect\.title/ }));
        fireEvent.click(screen.getByRole('switch', { name: 'enabled' }));
        fireEvent.click(screen.getByRole('button', { name: /step\.scope\.title/ }));

        assert.ok(within(cardOf('scope.default')).getByText('scope.tracking.off'));
        assert.ok(within(cardOf('scope.second')).getByText('scope.tracking.off'), 'a website inherits the switch');
    });

    it('tells a shop with one website and one store view there is nothing to choose, and moves on', () => {
        renderStep('scope', singleWebsiteConfig);
        assert.ok(screen.getByText('scope.single_website'));

        fireEvent.click(screen.getByRole('button', { name: 'scope.skip_to_connect' }));
        assert.equal(heading(), 'step.connect.title');
        const scopeStepButton = within(screen.getByRole('navigation', { name: 'stepper.label' })).getByRole('button', { name: /step\.scope\.title/ });
        assert.ok(scopeStepButton.textContent?.includes('step.status.done'));
    });

    it('sums the step up as the scope being edited once it is left', () => {
        renderStep('scope', multiWebsiteConfig);
        fireEvent.click(radio('scope.second'));
        fireEvent.click(screen.getByRole('button', { name: 'action.continue' }));

        const stepper = within(screen.getByRole('navigation', { name: 'stepper.label' }));
        assert.ok(stepper.getByRole('button', { name: /step\.scope\.title/ }).textContent?.includes('scope.website'));
    });
});
