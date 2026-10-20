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
    PRODUCTS_STEP,
    RequestError,
    requireSettingKey,
    requireStepId,
    SettingField,
    textOf,
    TextInput,
    useSetting,
    type PluginRegister,
} from '@hryvinskyi/datalayer-setup';
import type { WirePageConfig } from '../adapters/contract.ts';
import { recordingNavigator, settle } from '../test/fakes.ts';
import { multiWebsiteConfig, withSetting } from '../test/fixtures/page-config.ts';
import { renderStep, renderWizard } from '../test/render-wizard.tsx';
import { installResizeObserver } from '../test/resize-observer.ts';

afterEach(cleanup);

/** A plugin step owning the fixture's `sample` settings, rendering the website-only number with the kit. */
function SampleStep(): JSX.Element {
    const days = useSetting(requireSettingKey('sample_days'));
    return (
        <SettingField setting={days}>
            {(control) => (
                <TextInput
                    id={control.id}
                    value={textOf(days.value)}
                    onInput={days.set}
                    onBlur={control.onBlur}
                    disabled={control.disabled}
                    invalid={control.invalid}
                    describedBy={control.describedBy}
                    width="short"
                />
            )}
        </SettingField>
    );
}

const samplePlugin = (skippable = false): PluginRegister => (sdk) => {
    sdk.registerStep({
        id: requireStepId('sample'),
        after: PRODUCTS_STEP,
        icon: 'dns',
        title: 'step.sample.title',
        skippable,
        component: SampleStep,
    });
};

function withSample(config: WirePageConfig, patch: Partial<WirePageConfig> = {}): WirePageConfig {
    return { ...config, ...patch, phrases: { ...config.phrases, 'step.sample.title': 'step.sample.title' } };
}

const heading = (): string => screen.getByRole('heading', { level: 2 }).textContent ?? '';

const stepButton = (title: string): HTMLElement =>
    within(screen.getByRole('navigation', { name: 'stepper.label' })).getByRole('button', { name: new RegExp(title.replaceAll('.', '\\.')) });

describe('the wizard frame', () => {
    it('renders the header, the scope bar, the steps and the footer from the page config', () => {
        const wizard = renderWizard();

        assert.equal(screen.getByRole('heading', { level: 1 }).textContent, 'wizard.title');
        assert.equal(heading(), 'step.scope.title');
        assert.ok(screen.getByText('step.scope.intro'));
        assert.ok(screen.getByText('step.counter'));
        assert.equal(screen.getByRole<HTMLSelectElement>('combobox', { name: 'scope.label' }).value, 'default');
        assert.ok(screen.getByText('scope.default.applies'));

        const steps = within(screen.getByRole('navigation', { name: 'stepper.label' })).getAllByRole('button');
        assert.deepEqual(steps.map((button) => button.querySelector('.hdl-setup-step__title')?.textContent), [
            'step.scope.title',
            'step.connect.title',
            'step.track.title',
            'step.products.title',
            'step.review.title',
        ]);
        assert.equal(steps[0]?.getAttribute('aria-current'), 'step');
        assert.equal(steps[1]?.hasAttribute('aria-current'), false);
        assert.equal(screen.getByRole('progressbar', { name: 'stepper.progress' }).getAttribute('aria-valuenow'), '0');

        assert.equal(screen.getByRole('button', { name: 'action.back' }).hasAttribute('disabled'), true);
        assert.ok(screen.getByRole('button', { name: 'action.continue' }));
        assert.ok(screen.getByText('footer.none'));
        assert.deepEqual(wizard.logger.errors, []);
    });

    it('moves through the steps with the stepper, Continue and Back', () => {
        renderWizard();

        fireEvent.click(stepButton('step.track.title'));
        assert.equal(heading(), 'step.track.title');

        fireEvent.click(screen.getByRole('button', { name: 'action.continue' }));
        assert.equal(heading(), 'step.products.title');
        assert.ok(stepButton('step.track.title').textContent?.includes('step.status.done'));
        assert.equal(screen.getByRole('progressbar').getAttribute('aria-valuenow'), '1');

        fireEvent.click(screen.getByRole('button', { name: 'action.back' }));
        assert.equal(heading(), 'step.track.title');

        fireEvent.click(stepButton('step.review.title'));
        assert.equal(heading(), 'step.review.title');
        assert.equal(screen.queryByRole('button', { name: 'action.continue' }) === null, true, 'the last step saves instead');
        assert.equal(screen.getByRole('button', { name: 'action.save_all' }).hasAttribute('disabled'), true, 'nothing to save');
    });

    it('places a plugin step after its anchor and counts it among the steps', () => {
        renderWizard(withSample(multiWebsiteConfig), { plugins: [samplePlugin()] });
        const titles = within(screen.getByRole('navigation', { name: 'stepper.label' }))
            .getAllByRole('button')
            .map((button) => button.querySelector('.hdl-setup-step__title')?.textContent);
        assert.deepEqual(titles.slice(3), ['step.products.title', 'step.sample.title', 'step.review.title']);
    });

    it('keeps Continue back while the step has problems, and shows them on their fields', () => {
        const config = withSample(withSetting(multiWebsiteConfig, 'sample_days', { values: { default: '9999' } }));
        renderStep('sample', config, { plugins: [samplePlugin()] });
        assert.equal(screen.queryByRole('alert') === null, true);

        fireEvent.click(screen.getByRole('button', { name: 'action.continue' }));
        assert.equal(heading(), 'step.sample.title', 'Continue was refused');
        assert.equal(screen.getByRole('alert').textContent, 'error.range');
        assert.ok(stepButton('step.sample.title').textContent?.includes('step.status.current_attention'));

        fireEvent.input(screen.getByLabelText('sample_days'), { target: { value: '30' } });
        fireEvent.click(screen.getByRole('button', { name: 'action.continue' }));
        assert.equal(heading(), 'step.review.title');
    });

    it('does not hold a store view back on a website-only setting it cannot change', () => {
        const stored = withSetting(multiWebsiteConfig, 'sample_days', { values: { 'website:2': '9999' } });
        renderStep('sample', withSample(stored, { initialScope: 'store:3' }), { plugins: [samplePlugin()] });
        assert.equal(screen.getByLabelText('sample_days').hasAttribute('disabled'), true);

        fireEvent.click(screen.getByRole('button', { name: 'action.continue' }));
        assert.equal(heading(), 'step.review.title');
    });

    it('keeps the draft but forgets what was touched when the scope changes', () => {
        renderStep('sample', withSample(multiWebsiteConfig), { plugins: [samplePlugin()] });
        const input = screen.getByLabelText('sample_days');
        fireEvent.input(input, { target: { value: '9999' } });
        fireEvent.blur(input);
        assert.equal(screen.getByRole('alert').textContent, 'error.range');

        const scope = screen.getByRole('combobox', { name: 'scope.label' });
        fireEvent.change(scope, { target: { value: 'website:1' } });
        assert.ok(screen.getByText('scope.website.applies'));
        fireEvent.change(scope, { target: { value: 'default' } });

        assert.equal(screen.queryByRole('alert') === null, true, 'the touch belonged to the scope that was left');
        assert.equal(screen.getByLabelText<HTMLInputElement>('sample_days').value, '9999', 'the edit is kept');
        assert.ok(screen.getByText('footer.unsaved.one'));
    });

    it('offers Skip on an optional step and records the step as skipped', () => {
        renderStep('sample', withSample(multiWebsiteConfig), { plugins: [samplePlugin(true)] });
        fireEvent.click(screen.getByRole('button', { name: 'action.skip' }));
        assert.equal(heading(), 'step.review.title');
        assert.ok(stepButton('step.sample.title').textContent?.includes('step.status.skipped'));
    });

    it('turns the side stepper into chips when its own box is narrow', () => {
        const observer = installResizeObserver();
        try {
            renderWizard();
            act(() => observer.resize(900));
            assert.equal(screen.queryByRole('progressbar') === null, true);
            const chips = within(screen.getByRole('navigation', { name: 'stepper.label' })).getAllByRole('button');
            assert.equal(chips.length, 5);
            assert.equal(chips[0]?.getAttribute('aria-current'), 'step');
            assert.ok(chips[0]?.textContent?.includes('step.status.current'), 'the status is said, not only drawn');

            fireEvent.click(chips[2] ?? document.body);
            assert.equal(heading(), 'step.track.title');

            act(() => observer.resize(1280));
            assert.ok(screen.getByRole('progressbar'));
        } finally {
            observer.restore();
        }
    });
});

describe('step summaries and attention', () => {
    const summarised: PluginRegister = (sdk) => {
        sdk.registerStep({
            id: requireStepId('sample'),
            after: PRODUCTS_STEP,
            icon: 'dns',
            title: 'step.sample.title',
            component: SampleStep,
            summary: ({ view, t }) => t.t('step.sample.title') + ':' + textOf(view.value(requireSettingKey('sample_days'))),
            attention: ({ view }) => textOf(view.value(requireSettingKey('sample_days'))) === '1',
        });
    };

    it('sums a step up once it was left, never while it is still to do', () => {
        renderStep('sample', withSample(multiWebsiteConfig), { plugins: [summarised] });
        const sample = (): HTMLElement => stepButton('step.sample.title');
        assert.equal(sample().querySelector('.hdl-setup-step__summary') === null, true, 'nothing to sum up on first sight');

        fireEvent.click(screen.getByRole('button', { name: 'action.continue' }));
        assert.equal(sample().querySelector('.hdl-setup-step__summary')?.textContent, 'step.sample.title:395');
        assert.equal(stepButton('step.scope.title').querySelector('.hdl-setup-step__summary') === null, true, 'a step still to do');
    });

    it('marks a step its own check flags, wherever the person is', () => {
        renderStep('sample', withSample(multiWebsiteConfig), { plugins: [summarised] });
        fireEvent.input(screen.getByLabelText('sample_days'), { target: { value: '1' } });
        fireEvent.click(stepButton('step.scope.title'));
        assert.ok(stepButton('step.sample.title').textContent?.includes('step.status.attention'));
    });
});

describe('leaving and saving', () => {
    it('leaves at once without unsaved changes, to the page of the current scope', () => {
        const wizard = renderWizard();
        fireEvent.change(screen.getByRole('combobox', { name: 'scope.label' }), { target: { value: 'website:2' } });
        fireEvent.click(screen.getByRole('link', { name: 'action.advanced' }));
        fireEvent.click(screen.getByRole('button', { name: 'action.close' }));

        assert.deepEqual(wizard.navigator.asked, []);
        assert.deepEqual(wizard.navigator.visited, ['https://admin.test/advanced/website/2/', 'https://admin.test/close/website/2/']);
    });

    it('asks before unsaved changes are lost, and stays when the answer is no', () => {
        const navigator = recordingNavigator(false);
        renderStep('sample', withSample(multiWebsiteConfig), { plugins: [samplePlugin()], navigator });
        fireEvent.input(screen.getByLabelText('sample_days'), { target: { value: '30' } });

        fireEvent.click(screen.getByRole('button', { name: 'action.close' }));
        assert.deepEqual(navigator.asked, ['leave.confirm']);
        assert.deepEqual(navigator.visited, []);

        navigator.answer = true;
        fireEvent.click(screen.getByRole('link', { name: 'action.advanced' }));
        assert.deepEqual(navigator.visited, ['https://admin.test/advanced/default/']);
    });

    it('saves everything once from the last step, and keeps the edits when the request fails', async () => {
        const wizard = renderStep('sample', withSample(multiWebsiteConfig), { plugins: [samplePlugin()] });
        fireEvent.input(screen.getByLabelText('sample_days'), { target: { value: '30' } });
        assert.ok(screen.getByText('footer.unsaved_note'), 'before the last step the footer says when changes are saved');

        fireEvent.click(screen.getByRole('button', { name: 'action.continue' }));
        assert.equal(heading(), 'step.review.title');
        assert.equal(screen.queryByText('footer.unsaved_note') === null, true);

        const saveAll = screen.getByRole('button', { name: 'action.save_all' });
        assert.equal(saveAll.hasAttribute('disabled'), false);
        fireEvent.click(saveAll);
        const saving = screen.getByRole('button', { name: 'action.saving' });
        assert.equal(saving.getAttribute('aria-busy'), 'true');
        assert.equal(saving.getAttribute('aria-disabled'), 'true');
        assert.equal(saving.hasAttribute('disabled'), false, 'a busy button keeps its focus');
        fireEvent.click(saving);
        assert.equal(wizard.gateway.saves.length, 1, 'a second click sends nothing');
        assert.deepEqual(wizard.gateway.saves[0]?.input, { changes: [{ scope: 'default', key: 'sample_days', op: 'set', value: '30' }] });

        await act(async () => {
            wizard.gateway.saves[0]?.answer.reject(new RequestError('expired'));
            await settle();
        });
        assert.equal(screen.getByRole('alert').querySelector('.hdl-setup-strip__text')?.textContent, 'request.expired');
        assert.equal(screen.getByRole('button', { name: 'action.save_all' }).hasAttribute('disabled'), false);
        assert.ok(screen.getByText('footer.unsaved.one'), 'every edit is kept');
    });
});

describe('a step that breaks', () => {
    const Throwing = (): JSX.Element => {
        throw new Error('render bug');
    };

    const broken: PluginRegister = (sdk) => {
        sdk.registerStep({ id: requireStepId('sample'), after: PRODUCTS_STEP, icon: 'dns', title: 'step.sample.title', component: Throwing });
    };

    it('says so in its own place, logs why, and leaves the rest of the wizard working', () => {
        const wizard = renderStep('sample', withSample(multiWebsiteConfig), { plugins: [broken] });

        assert.equal(heading(), 'step.sample.title');
        assert.equal(screen.getByRole('alert').textContent, 'step.failed');
        assert.deepEqual(wizard.logger.errors.map((entry) => entry.message), ['The setup step sample failed to render']);

        fireEvent.click(stepButton('step.track.title'));
        assert.equal(heading(), 'step.track.title');
        assert.ok(screen.getByRole('radiogroup', { name: 'track.presets' }), 'another step renders as usual');
        fireEvent.click(screen.getByRole('button', { name: 'action.continue' }));
        assert.equal(heading(), 'step.products.title');
    });

    it('keeps the stepper when a step\'s summary or check throws, and logs it once', () => {
        const faulty: PluginRegister = (sdk) => {
            sdk.registerStep({
                id: requireStepId('sample'),
                after: PRODUCTS_STEP,
                icon: 'dns',
                title: 'step.sample.title',
                component: SampleStep,
                summary: () => {
                    throw new Error('summary bug');
                },
                attention: () => {
                    throw new Error('attention bug');
                },
                issues: () => {
                    throw new Error('issues bug');
                },
            });
        };
        const wizard = renderStep('sample', withSample(multiWebsiteConfig), { plugins: [faulty] });
        fireEvent.click(screen.getByRole('button', { name: 'action.continue' }));
        fireEvent.click(stepButton('step.scope.title'));

        assert.ok(stepButton('step.sample.title').textContent?.includes('step.status.done'));
        assert.equal(stepButton('step.sample.title').querySelector('.hdl-setup-step__summary') === null, true);
        const messages = wizard.logger.errors.map((entry) => entry.message);
        assert.deepEqual([...new Set(messages)].sort(), [
            'The setup step sample failed to answer its attention',
            'The setup step sample failed to answer its issues',
            'The setup step sample failed to answer its summary',
        ]);
        assert.equal(messages.length, 3, 'each failure is logged once');
    });
});

describe('focus', () => {
    it('moves to the title of the step that opens, and stays put on the first render', () => {
        renderWizard();
        assert.notEqual(document.activeElement, screen.getByRole('heading', { level: 2 }));

        fireEvent.click(screen.getByRole('button', { name: 'action.continue' }));
        const title = screen.getByRole('heading', { level: 2 });
        assert.equal(title.textContent, 'step.connect.title');
        assert.equal(document.activeElement, title);
        assert.equal(title.getAttribute('tabindex'), '-1', 'reachable from script, not from the Tab key');
    });

    it('moves to the first field with a problem when Continue is refused', () => {
        const config = withSample(withSetting(multiWebsiteConfig, 'sample_days', { values: { default: '9999' } }));
        renderStep('sample', config, { plugins: [samplePlugin()] });

        fireEvent.click(screen.getByRole('button', { name: 'action.continue' }));
        assert.equal(heading(), 'step.sample.title');
        assert.equal(document.activeElement, screen.getByLabelText('sample_days'));
    });
});

describe('a step with state of its own', () => {
    it('has its summary and attention read again when that state changes', () => {
        let verdict = 'first';
        const listeners = new Set<() => void>();
        const announce = (next: string): void => {
            verdict = next;
            listeners.forEach((listener) => listener());
        };
        const stateful: PluginRegister = (sdk) => {
            sdk.registerStep({
                id: requireStepId('sample'),
                after: PRODUCTS_STEP,
                icon: 'dns',
                title: 'step.sample.title',
                component: SampleStep,
                summary: () => `verdict:${verdict}`,
                attention: () => verdict === 'bad',
                subscribe: (listener) => {
                    listeners.add(listener);
                    return () => void listeners.delete(listener);
                },
            });
        };
        renderStep('sample', withSample(multiWebsiteConfig), { plugins: [stateful] });
        fireEvent.click(screen.getByRole('button', { name: 'action.continue' }));
        const summary = (): string | null | undefined => stepButton('step.sample.title').querySelector('.hdl-setup-step__summary')?.textContent;
        assert.equal(summary(), 'verdict:first');

        act(() => announce('bad'));
        assert.equal(summary(), 'verdict:bad');
        assert.ok(stepButton('step.sample.title').textContent?.includes('step.status.attention'));

        cleanup();
        assert.equal(listeners.size, 0, 'the stepper stops listening when it goes away');
    });
});
