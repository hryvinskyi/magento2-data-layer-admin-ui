/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { cleanup, fireEvent, screen, within } from '@testing-library/preact';
import type { WirePageConfig } from '../../adapters/contract.ts';
import { LOCK_MESSAGE, multiWebsiteConfig, withSetting } from '../../test/fixtures/page-config.ts';
import { renderStep } from '../../test/render-wizard.tsx';

afterEach(cleanup);

const at = (scope: string, config: WirePageConfig = multiWebsiteConfig): WirePageConfig => ({ ...config, initialScope: scope });

const heading = (): string => screen.getByRole('heading', { level: 2 }).textContent ?? '';
const field = (label: string): HTMLInputElement => screen.getByLabelText<HTMLInputElement>(label);
const mode = (key: string): HTMLInputElement => screen.getByRole<HTMLInputElement>('radio', { name: new RegExp(`^mode\\.${key}\\b`) });
const sending = (): HTMLElement => screen.getByRole('switch', { name: 'enabled' });
const hostDisclosure = (): HTMLElement => screen.getByRole('button', { name: 'connect.host_disclosure' });

const type = (label: string, value: string): void => {
    fireEvent.input(field(label), { target: { value } });
};

const leave = (label: string): void => {
    fireEvent.blur(field(label));
};

/** The field's whole row: label, control, origin line and its action. */
function rowOf(label: string): HTMLElement {
    const row = field(label).closest('.hdl-setup-field');
    assert.ok(row instanceof HTMLElement, `${label} sits in a field row`);
    return row;
}

describe('the connect step', () => {
    it('shows the connection at the default scope: sending, the way pages load Google and the container', () => {
        renderStep('connect', multiWebsiteConfig);

        assert.equal(sending().getAttribute('aria-checked'), 'true');
        assert.ok(screen.getByRole('radiogroup', { name: 'mode.label' }));
        assert.equal(mode('gtm').checked, true);
        assert.equal(mode('gtag').checked, false);
        assert.equal(mode('both').checked, false);
        assert.ok(within(screen.getByRole('radiogroup', { name: 'mode.label' })).getByText('mode.recommended'));
        assert.equal(field('container_id').value, 'GTM-AB12CD3');
        assert.equal(field('container_id').getAttribute('placeholder'), 'connect.placeholder.container_id');
        assert.equal(screen.queryByLabelText('measurement_id') === null, true, 'the container mode has no Measurement ID');
        assert.equal(screen.queryByRole('alert') === null, true, 'no warning for the recommended mode');
    });

    it('states what the store outputs, with the script address and a link to the tag tools', () => {
        renderStep('connect', multiWebsiteConfig);

        assert.ok(screen.getByText('status.loader.ok'));
        assert.ok(screen.getByText('status.loader.ok.note'));
        assert.ok(screen.getByText('status.line.gtm'));
        assert.ok(screen.getByText('https://www.googletagmanager.com/gtm.js?id=GTM-AB12CD3'));
        const link = screen.getByRole('link', { name: /status\.tag_assistant/ });
        assert.equal(link.getAttribute('href'), 'https://tagassistant.google.com/');
        assert.ok(link.getAttribute('rel')?.includes('noopener'));
    });

    it('says nothing is sent while sending is off, and offers no link', () => {
        renderStep('connect', multiWebsiteConfig);
        fireEvent.click(sending());

        assert.equal(sending().getAttribute('aria-checked'), 'false');
        assert.ok(screen.getByText('status.loader.off'));
        assert.equal(screen.queryByText('status.line.gtm') === null, true);
        assert.equal(screen.queryByRole('link', { name: /status\.tag_assistant/ }) === null, true);
        assert.ok(screen.getByText('footer.unsaved.one'));
    });

    it('switches to gtag.js: the container is emptied, a Measurement ID is asked for, the panel follows', () => {
        renderStep('connect', multiWebsiteConfig);
        fireEvent.click(mode('gtag'));

        assert.equal(mode('gtag').checked, true);
        assert.equal(screen.queryByLabelText('container_id') === null, true, 'the container is not used any more');
        assert.equal(field('measurement_id').value, '');
        assert.ok(screen.getByText('status.loader.empty'));
        assert.ok(screen.getByText('status.line.gtag'));
        assert.equal(screen.queryByText('status.line.gtm') === null, true);
        assert.ok(screen.getByText('footer.unsaved.one'), 'emptying the container is the one change');

        type('measurement_id', 'G-ABC123');
        assert.ok(screen.getByText('status.loader.ok'));
        assert.ok(screen.getByText('https://www.googletagmanager.com/gtag/js?id=G-ABC123'));
        assert.ok(screen.getByText('footer.unsaved.other'));
    });

    it('goes back to the container mode and drops the Measurement ID typed meanwhile, leaving nothing to save', () => {
        renderStep('connect', multiWebsiteConfig);
        fireEvent.click(mode('both'));
        type('measurement_id', 'G-ABC123');
        assert.ok(screen.getByText('footer.unsaved.one'));
        fireEvent.click(mode('gtm'));

        assert.equal(mode('gtm').checked, true);
        assert.equal(screen.queryByLabelText('measurement_id') === null, true);
        assert.equal(field('container_id').value, 'GTM-AB12CD3', 'the container stays');
        assert.ok(screen.getByText('footer.none'), 'nothing was stored, so nothing is left to save');
        assert.equal(screen.queryByText(/footer\.unsaved/), null);
    });

    it('goes back to the container mode and empties a stored Measurement ID it no longer uses', () => {
        renderStep('connect', withSetting(multiWebsiteConfig, 'measurement_id', { values: { default: 'G-ABC123' } }));
        assert.equal(mode('both').checked, true);
        fireEvent.click(mode('gtm'));

        assert.equal(mode('gtm').checked, true);
        assert.ok(screen.getByText('footer.unsaved.one'), 'the emptied Measurement ID is the one change');
    });

    it('loads both and warns that Google may count events twice', () => {
        renderStep('connect', multiWebsiteConfig);
        fireEvent.click(mode('both'));

        assert.equal(mode('both').checked, true);
        assert.equal(field('container_id').value, 'GTM-AB12CD3');
        assert.equal(field('measurement_id').value, '');
        assert.equal(screen.getByRole('alert').textContent, 'warning.double_count');
        assert.ok(screen.getByText('status.line.gtm'));
        assert.ok(screen.getByText('status.line.gtag'));
        assert.ok(screen.getByText('status.loader.empty'), 'one loader still has no ID');

        type('measurement_id', 'G-ABC123');
        assert.ok(screen.getByText('status.loader.ok'));
    });

    it('opens on the mode the stored IDs imply', () => {
        const gtagOnly = withSetting(withSetting(multiWebsiteConfig, 'container_id', { values: {} }), 'measurement_id', { values: { default: 'G-ABC123' } });
        renderStep('connect', gtagOnly);

        assert.equal(mode('gtag').checked, true);
        assert.equal(field('measurement_id').value, 'G-ABC123');
        assert.equal(screen.queryByLabelText('container_id') === null, true);
        assert.ok(screen.getByText('https://www.googletagmanager.com/gtag/js?id=G-ABC123'));
    });

    it('shows a malformed container once its field was left, and says nothing is output', () => {
        renderStep('connect', multiWebsiteConfig);
        type('container_id', 'not-an-id');
        assert.equal(screen.queryByRole('alert') === null, true, 'the field was not left yet');

        leave('container_id');
        assert.equal(screen.getByRole('alert').textContent, 'error.container_id.format');
        assert.equal(field('container_id').getAttribute('aria-invalid'), 'true');
        assert.ok(screen.getByText('status.loader.invalid'));
        assert.ok(screen.getByText('status.line.not_output'));
        assert.equal(screen.queryByRole('link', { name: /status\.tag_assistant/ }) === null, true);
    });

    it('asks for a container while sending is on in the container mode', () => {
        renderStep('connect', multiWebsiteConfig);
        type('container_id', '');
        leave('container_id');

        assert.equal(screen.getByRole('alert').textContent, 'error.container_id.required');
        assert.ok(screen.getByText('status.loader.empty'));
    });

    it('holds Continue back while an ID is wrong and shows the problem on its field', () => {
        renderStep('connect', multiWebsiteConfig);
        type('container_id', 'not-an-id');
        assert.equal(screen.queryByRole('alert') === null, true);

        fireEvent.click(screen.getByRole('button', { name: 'action.continue' }));
        assert.equal(heading(), 'step.connect.title', 'Continue was refused');
        assert.equal(screen.getByRole('alert').textContent, 'error.container_id.format');

        type('container_id', 'GTM-XYZ789');
        fireEvent.click(screen.getByRole('button', { name: 'action.continue' }));
        assert.equal(heading(), 'step.track.title');
    });

    it('reveals the script host behind a disclosure and builds the address from it', () => {
        renderStep('connect', multiWebsiteConfig);
        assert.equal(hostDisclosure().getAttribute('aria-expanded'), 'false');
        assert.equal(screen.queryByLabelText('script_host') === null, true);

        fireEvent.click(hostDisclosure());
        assert.equal(hostDisclosure().getAttribute('aria-expanded'), 'true');
        assert.equal(field('script_host').getAttribute('placeholder'), 'www.googletagmanager.com');
        assert.ok(screen.getByText('field.script_host.help'));

        type('script_host', 'gtm.example.com');
        assert.ok(screen.getByText('https://gtm.example.com/gtm.js?id=GTM-AB12CD3'));

        fireEvent.click(hostDisclosure());
        assert.equal(screen.queryByLabelText('script_host') === null, true);
    });

    it('opens the disclosure when a script host is already set, and refuses a host with a path', () => {
        renderStep('connect', withSetting(multiWebsiteConfig, 'script_host', { values: { default: 'gtm.example.com' } }));
        assert.equal(hostDisclosure().getAttribute('aria-expanded'), 'true');
        assert.equal(field('script_host').value, 'gtm.example.com');

        type('script_host', 'https://gtm.example.com/path');
        leave('script_host');
        assert.equal(screen.getByRole('alert').textContent, 'error.format', 'the page sends no phrase of its own for this field here');
        assert.ok(screen.getByText('status.loader.invalid'));
    });

    it('leaves an inherited container alone until it is overridden', () => {
        renderStep('connect', at('website:1'));

        assert.equal(field('container_id').disabled, true);
        assert.equal(field('container_id').value, 'GTM-AB12CD3');
        fireEvent.click(within(rowOf('container_id')).getByRole('button', { name: 'action.override' }));
        assert.equal(field('container_id').disabled, false);
        type('container_id', 'GTM-NEW123');
        assert.ok(screen.getByText('https://www.googletagmanager.com/gtm.js?id=GTM-NEW123'));
    });

    it('shows a website with its own container as set there', () => {
        renderStep('connect', at('website:2'));

        assert.equal(field('container_id').disabled, false);
        assert.equal(field('container_id').value, 'GTM-WH45EF6');
        assert.ok(screen.getByText('https://www.googletagmanager.com/gtm.js?id=GTM-WH45EF6'));
    });

    it('holds back only the loader that would empty an ID deployment configuration locks', () => {
        renderStep('connect', withSetting(multiWebsiteConfig, 'container_id', { locks: { default: LOCK_MESSAGE } }));

        assert.equal(mode('gtag').disabled, true, 'gtag.js alone would empty the locked container ID');
        assert.equal(mode('gtm').disabled, false, 'the container alone empties a Measurement ID that is empty already');
        assert.equal(mode('both').disabled, false, 'both empties nothing');
        assert.equal(screen.getByRole('radiogroup', { name: 'mode.label' }).hasAttribute('aria-disabled'), false);
        assert.equal(field('container_id').disabled, true);
        assert.ok(screen.getByText(LOCK_MESSAGE));

        fireEvent.click(mode('both'));
        assert.equal(mode('both').checked, true, 'an available loader is still chosen');
    });

    it('says above the choice of loader which ID holds a loader back, even when that ID\'s field is hidden', () => {
        const noContainer = withSetting(multiWebsiteConfig, 'container_id', { values: {} });
        const locked = withSetting(noContainer, 'measurement_id', { values: { default: 'G-LOCKED1' }, locks: { default: LOCK_MESSAGE } });
        renderStep('connect', { ...locked, phrases: { ...locked.phrases, 'connect.mode.blocked': 'Mode follows %1' } });

        assert.equal(mode('gtag').checked, true);
        assert.equal(screen.queryByLabelText('container_id'), null, 'the gtag.js mode hides the container ID');
        const explanation = screen.getByText('Mode follows measurement_id');
        assert.ok(
            (explanation.compareDocumentPosition(mode('gtm')) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
            'the explanation comes before the choices',
        );
        assert.equal(mode('gtm').disabled, true, 'the container alone would empty the locked Measurement ID');
        assert.equal(mode('gtag').disabled, false);
        assert.equal(mode('both').disabled, false);
        assert.equal(screen.getAllByText(/^Mode follows/).length, 1, 'one line per ID that holds a loader back');
    });

    it('offers the choice of loader without an explanation while every ID can change', () => {
        renderStep('connect', at('website:1', { ...multiWebsiteConfig, phrases: { ...multiWebsiteConfig.phrases, 'connect.mode.blocked': 'Mode follows %1' } }));

        assert.equal(mode('gtag').disabled, false);
        assert.equal(screen.queryByText(/^Mode follows/), null);
    });

    it('sums the step up once it was left', () => {
        renderStep('connect', multiWebsiteConfig);
        fireEvent.click(screen.getByRole('button', { name: 'action.continue' }));

        const connect = within(screen.getByRole('navigation', { name: 'stepper.label' })).getByRole('button', { name: /step\.connect\.title/ });
        assert.ok(connect.textContent?.includes('summary.connect.gtm'));
    });

    it('sums up that nothing is sent while sending is off', () => {
        renderStep('connect', multiWebsiteConfig);
        fireEvent.click(sending());
        fireEvent.click(screen.getByRole('button', { name: 'action.continue' }));

        const connect = within(screen.getByRole('navigation', { name: 'stepper.label' })).getByRole('button', { name: /step\.connect\.title/ });
        assert.ok(connect.textContent?.includes('summary.connect.off'));
    });
});
