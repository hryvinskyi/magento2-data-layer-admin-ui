/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import {
    Button,
    flagOf,
    iconOr,
    isIconName,
    MessageStrip,
    Notice,
    OriginNotice,
    RadioCards,
    SecretInput,
    SelectInput,
    SettingField,
    StatusPanel,
    Switch,
    textOf,
    TextInput,
    useSetting,
    useWizard,
    type SettingKey,
} from '@hryvinskyi/datalayer-setup';
import type { WirePageConfig } from '../../adapters/contract.ts';
import { LOCK_MESSAGE, multiWebsiteConfig, withSetting } from '../../test/fixtures/page-config.ts';
import { key } from '../../test/fixtures/setup-state.ts';
import { createTestRuntime, providerFor } from '../../test/wizard-harness.tsx';

afterEach(cleanup);

const at = (scope: string): WirePageConfig => ({ ...multiWebsiteConfig, initialScope: scope });

function renderWithin(ui: JSX.Element, config: WirePageConfig = multiWebsiteConfig): void {
    render(ui, { wrapper: providerFor(createTestRuntime(config)) });
}

/** A text field bound to a setting, the way a step renders one. */
function TextField({ setting: settingKey }: { readonly setting: SettingKey }): JSX.Element {
    const setting = useSetting(settingKey);
    return (
        <SettingField setting={setting} help="help line">
            {(control) => (
                <TextInput
                    id={control.id}
                    value={textOf(setting.value)}
                    onInput={setting.set}
                    onBlur={control.onBlur}
                    disabled={control.disabled}
                    invalid={control.invalid}
                    describedBy={control.describedBy}
                    mono
                />
            )}
        </SettingField>
    );
}

function ChoiceField({ setting: settingKey }: { readonly setting: SettingKey }): JSX.Element {
    const setting = useSetting(settingKey);
    return (
        <SettingField setting={setting}>
            {(control) => (
                <SelectInput
                    id={control.id}
                    value={textOf(setting.value)}
                    options={setting.definition.options}
                    onChange={setting.set}
                    disabled={control.disabled}
                    describedBy={control.describedBy}
                />
            )}
        </SettingField>
    );
}

function SecretField(): JSX.Element {
    const setting = useSetting(key('sample_secret'));
    return (
        <SettingField setting={setting}>
            {(control) => (
                <SecretInput
                    id={control.id}
                    value={setting.value}
                    onReplace={(text) => setting.set({ replace: text })}
                    onKeep={setting.replacing ? setting.discard : undefined}
                    onBlur={control.onBlur}
                    disabled={control.disabled}
                    invalid={control.invalid}
                    describedBy={control.describedBy}
                />
            )}
        </SettingField>
    );
}

describe('Switch', () => {
    function Toggle({ disabled = false }: { readonly disabled?: boolean }): JSX.Element {
        const [on, setOn] = useState(false);
        return <Switch checked={on} onChange={setOn} label="send view_item" disabled={disabled} size="small" />;
    }

    it('toggles, reports its state and says it in words', () => {
        renderWithin(<Toggle />);
        const control = screen.getByRole('switch', { name: 'send view_item' });
        assert.equal(control.getAttribute('aria-checked'), 'false');
        assert.equal(control.textContent, 'switch.no');

        fireEvent.click(control);
        assert.equal(control.getAttribute('aria-checked'), 'true');
        assert.equal(control.textContent, 'switch.yes');
    });

    it('does not change while disabled', () => {
        renderWithin(<Toggle disabled />);
        const control = screen.getByRole('switch', { name: 'send view_item' });
        fireEvent.click(control);
        assert.equal(control.getAttribute('aria-checked'), 'false');
        assert.equal(control.hasAttribute('disabled'), true);
    });

    it('takes its name from the field label inside a setting field', () => {
        function EnabledField(): JSX.Element {
            const setting = useSetting(key('enabled'));
            return (
                <SettingField setting={setting}>
                    {(control) => <Switch id={control.id} checked={flagOf(setting.value)} onChange={setting.set} disabled={control.disabled} />}
                </SettingField>
            );
        }
        renderWithin(<EnabledField />);
        const control = screen.getByRole('switch', { name: 'enabled' });
        fireEvent.click(control);
        assert.equal(control.getAttribute('aria-checked'), 'false', 'the stored yes was switched off');
    });
});

describe('origin notice', () => {
    /** The notice for one setting, the way a step puts it above the controls it disables. */
    function SettingNotice({ setting: settingKey }: { readonly setting: SettingKey }): JSX.Element | null {
        const setting = useSetting(settingKey);
        return <OriginNotice origin={setting.origin} onOverride={setting.override} />;
    }

    it('explains an inherited value with the scope it comes from and the scope being edited, and overrides it', () => {
        const config: WirePageConfig = {
            ...at('store:1'),
            phrases: { ...multiWebsiteConfig.phrases, 'origin.explain.inherited': 'From %1, read-only in %2' },
        };
        renderWithin(<SettingNotice setting={key('container_id')} />, config);
        assert.ok(screen.getByText('From scope.default, read-only in scope.main_en'));

        fireEvent.click(screen.getByRole('button', { name: 'action.override' }));

        assert.equal(screen.queryByText(/^From /), null, 'an own value needs no explanation');
    });

    it('shows the lock message without an action where the deployment fixes the value', () => {
        renderWithin(<SettingNotice setting={key('hidden_price')} />, at('website:1'));
        assert.ok(screen.getByText(LOCK_MESSAGE));
        assert.equal(screen.queryByRole('button'), null);
    });

    it('points at the scope where a setting of a wider reach is set', () => {
        renderWithin(<SettingNotice setting={key('sample_days')} />, at('store:3'));
        assert.ok(screen.getByText('origin.reach.website'));
        assert.equal(screen.queryByRole('button'), null);
    });

    it('shows nothing at the default scope, where every value can be changed', () => {
        renderWithin(<SettingNotice setting={key('container_id')} />);
        assert.equal(screen.queryByText(/./), null);
    });
});

describe('setting field', () => {
    it('shows an inherited value disabled, and Override here makes it the scope\'s own', () => {
        renderWithin(<TextField setting={key('container_id')} />, at('store:1'));
        const input = screen.getByLabelText('container_id');
        assert.equal(input.hasAttribute('disabled'), true);
        assert.ok(screen.getByText('origin.inherited'));
        assert.equal(screen.getByText('field.reach.store').textContent, 'field.reach.store', 'the scope tag names the reach');

        fireEvent.click(screen.getByRole('button', { name: 'action.override' }));
        assert.equal(screen.getByLabelText('container_id').hasAttribute('disabled'), false);
        assert.ok(screen.getByText('origin.store'));

        fireEvent.click(screen.getByRole('button', { name: 'action.inherit' }));
        assert.equal(screen.getByLabelText('container_id').hasAttribute('disabled'), true);
        assert.ok(screen.getByText('origin.inherited'));
    });

    it('says which scopes override the default value, without an action', () => {
        renderWithin(<TextField setting={key('container_id')} />);
        assert.ok(screen.getByText('origin.overridden.one'));
        assert.equal(screen.queryByRole('button', { name: 'action.override' }) === null, true);
        assert.equal(screen.queryByRole('button', { name: 'action.inherit' }) === null, true);
    });

    it('fills the names of the overriding scopes into the origin line', () => {
        const config: WirePageConfig = {
            ...multiWebsiteConfig,
            phrases: { ...multiWebsiteConfig.phrases, 'origin.overridden.one': 'Default · %2 overrides' },
        };
        renderWithin(<TextField setting={key('container_id')} />, config);
        assert.ok(screen.getByText('Default · scope.second overrides'));
    });

    it('disables a locked field and shows the lock message instead of an action', () => {
        renderWithin(<ChoiceField setting={key('hidden_price')} />, at('website:1'));
        assert.equal(screen.getByLabelText('hidden_price').hasAttribute('disabled'), true);
        assert.ok(screen.getByText(LOCK_MESSAGE));
        assert.equal(screen.queryByRole('button', { name: /action\./ }) === null, true);
    });

    it('points a store view at the website for a website-only setting', () => {
        renderWithin(<TextField setting={key('sample_days')} />, at('store:3'));
        assert.equal(screen.getByLabelText('sample_days').hasAttribute('disabled'), true);
        assert.ok(screen.getByText('origin.reach.website'));
        assert.equal(screen.queryByRole('button', { name: 'action.override' }) === null, true);
    });

    it('shows a problem only once the field was left, linked to the control', () => {
        renderWithin(<TextField setting={key('script_host')} />);
        const input = screen.getByLabelText('script_host');
        fireEvent.input(input, { target: { value: 'not a host' } });
        assert.equal(screen.queryByRole('alert') === null, true, 'nothing while typing');
        assert.equal(input.getAttribute('aria-invalid'), 'false');

        fireEvent.blur(input);
        const alert = screen.getByRole('alert');
        assert.equal(alert.textContent, 'error.format');
        assert.equal(input.getAttribute('aria-invalid'), 'true');
        assert.deepEqual(input.getAttribute('aria-describedby')?.split(' '), ['hdl-setup-field-script_host-help', alert.id]);
    });

    it('never shows a stored secret, and Replace starts typing a new one', () => {
        renderWithin(<SecretField />);
        const masked = screen.getByLabelText('sample_secret');
        assert.equal(masked.getAttribute('type'), 'text');
        assert.equal(masked.hasAttribute('readonly'), true);
        assert.ok(screen.getByText('secret.stored'));

        fireEvent.click(screen.getByRole('button', { name: 'secret.replace' }));
        const password = screen.getByLabelText('sample_secret');
        assert.equal(password.getAttribute('type'), 'password');
        fireEvent.input(password, { target: { value: 's3cret' } });
        assert.equal(screen.getByLabelText('sample_secret').getAttribute('value') ?? '', '');
        assert.equal(screen.getByLabelText<HTMLInputElement>('sample_secret').value, 's3cret');
    });

    it('takes a replacement back with "Keep the stored secret", leaving nothing to save', () => {
        function Pending(): JSX.Element {
            return <output data-testid="pending">{useWizard().pending.length}</output>;
        }
        renderWithin(<><SecretField /><Pending /></>);
        assert.equal(screen.queryByRole('button', { name: 'secret.keep' }), null, 'nothing is being replaced');

        fireEvent.click(screen.getByRole('button', { name: 'secret.replace' }));
        fireEvent.input(screen.getByLabelText('sample_secret'), { target: { value: 's3cret' } });
        assert.equal(screen.getByTestId('pending').textContent, '1');

        fireEvent.click(screen.getByRole('button', { name: 'secret.keep' }));
        assert.equal(screen.getByLabelText('sample_secret').hasAttribute('readonly'), true, 'the stored secret is shown masked again');
        assert.ok(screen.getByRole('button', { name: 'secret.replace' }));
        assert.equal(screen.getByTestId('pending').textContent, '0');
    });

    it('offers no "Keep" where no secret is stored, and clearing what was typed leaves nothing to save', () => {
        function Pending(): JSX.Element {
            return <output data-testid="pending">{useWizard().pending.length}</output>;
        }
        renderWithin(<><SecretField /><Pending /></>, withSetting(multiWebsiteConfig, 'sample_secret', { values: {} }));
        const input = screen.getByLabelText('sample_secret');
        assert.equal(input.getAttribute('type'), 'password');

        fireEvent.input(input, { target: { value: 's3cret' } });
        assert.equal(screen.getByTestId('pending').textContent, '1');
        assert.equal(screen.queryByRole('button', { name: 'secret.keep' }), null);
        fireEvent.input(screen.getByLabelText('sample_secret'), { target: { value: '' } });
        assert.equal(screen.getByTestId('pending').textContent, '0');
    });
});

describe('choices and messages', () => {
    it('picks one radio card in a named group', () => {
        const picked: string[] = [];
        renderWithin(
            <RadioCards
                name="mode"
                label="mode.label"
                value="gtm"
                options={[
                    { value: 'gtm', label: 'mode.gtm', icon: 'deployed_code', badge: 'Recommended', description: 'mode.gtm.description' },
                    { value: 'gtag', label: 'mode.gtag', icon: 'analytics' },
                ]}
                onChange={(value) => void picked.push(value)}
            />,
        );
        const group = screen.getByRole('radiogroup', { name: 'mode.label' });
        assert.equal(screen.getByRole<HTMLInputElement>('radio', { name: /mode\.gtm/ }).checked, true);
        fireEvent.click(screen.getByRole('radio', { name: /mode\.gtag/ }));
        assert.deepEqual(picked, ['gtag']);
        assert.ok(group.contains(screen.getByText('Recommended')));
    });

    it('keeps one option out of reach while the others can still be picked', () => {
        const picked: string[] = [];
        renderWithin(
            <RadioCards
                name="mode"
                label="mode.label"
                value="gtm"
                options={[
                    { value: 'gtm', label: 'mode.gtm' },
                    { value: 'gtag', label: 'mode.gtag', disabled: true },
                    { value: 'both', label: 'mode.both' },
                ]}
                onChange={(value) => void picked.push(value)}
            />,
        );
        const gtag = screen.getByRole<HTMLInputElement>('radio', { name: /mode\.gtag/ });
        assert.equal(gtag.disabled, true);
        assert.equal(gtag.closest('label')?.getAttribute('data-disabled'), 'true');
        assert.equal(screen.getByRole<HTMLInputElement>('radio', { name: /mode\.both/ }).disabled, false);
        assert.equal(screen.getByRole('radiogroup', { name: 'mode.label' }).hasAttribute('aria-disabled'), false);
        fireEvent.click(screen.getByRole('radio', { name: /mode\.both/ }));
        assert.deepEqual(picked, ['both']);
    });

    it('marks a busy button busy without taking it out of the focus order, and ignores presses', () => {
        let pressed = 0;
        renderWithin(<Button busy onClick={() => void pressed++}>action.saving</Button>);
        const button = screen.getByRole('button', { name: 'action.saving' });
        button.focus();
        fireEvent.click(button);

        assert.equal(pressed, 0);
        assert.equal(button.hasAttribute('disabled'), false);
        assert.equal(button.getAttribute('aria-disabled'), 'true');
        assert.equal(button.getAttribute('aria-busy'), 'true');
        assert.equal(document.activeElement, button);
    });

    it('carries the tone in a glyph and a role, and offers its action', () => {
        let skipped = 0;
        renderWithin(
            <div>
                <MessageStrip tone="success" action={{ label: 'scope.skip_to_connect', onClick: () => void skipped++ }}>scope.single_website</MessageStrip>
                <Notice tone="warning">warning.double_count</Notice>
                <Notice tone="info">info line</Notice>
            </div>,
        );
        assert.equal(screen.getByRole('status').textContent, 'scope.single_websitescope.skip_to_connect');
        assert.equal(screen.getByRole('alert').textContent, 'warning.double_count');
        assert.equal(screen.getByText('info line').closest('[role]') === null, true, 'an informational note is plain text');
        fireEvent.click(screen.getByRole('button', { name: 'scope.skip_to_connect' }));
        assert.equal(skipped, 1);
    });

    it('draws a muted notice on the grey ground and an ordinary one without it', () => {
        renderWithin(
            <div>
                <Notice tone="info" muted>aside line</Notice>
                <Notice tone="info">info line</Notice>
            </div>,
        );
        const aside = screen.getByText('aside line').closest('.hdl-setup-notice');
        const plain = screen.getByText('info line').closest('.hdl-setup-notice');
        assert.equal(aside?.classList.contains('hdl-setup-notice--muted'), true);
        assert.equal(aside?.getAttribute('data-tone'), 'info');
        assert.equal(plain?.classList.contains('hdl-setup-notice--muted'), false);
    });

    it('shows a status in words and lines, announcing only the state word as it changes', () => {
        renderWithin(
            <StatusPanel
                title="status.output"
                state="invalid"
                word="status.loader.invalid"
                note="status.loader.invalid.note"
                lines={[{ label: 'GTM', text: 'https://www.googletagmanager.com/gtm.js?id=GTM-AB12CD3' }]}
            />,
        );
        const announced = screen.getAllByRole('status');
        assert.deepEqual(announced.map((region) => region.textContent), ['status.loader.invalid']);
        assert.ok(screen.getByText('status.loader.invalid.note'), 'the note is shown, not announced');
        assert.ok(screen.getByText('https://www.googletagmanager.com/gtm.js?id=GTM-AB12CD3'), 'so are the lines');
    });
});

describe('icons', () => {
    it('draws the names it knows and falls back for names that arrive at run time', () => {
        assert.equal(isIconName('storefront'), true);
        assert.equal(isIconName('toString'), false, 'no inherited property passes for a glyph');
        assert.equal(iconOr('bolt', 'tune'), 'bolt');
        assert.equal(iconOr('no_such_glyph', 'tune'), 'tune');
        assert.equal(iconOr(undefined, 'tune'), 'tune');
    });
});
