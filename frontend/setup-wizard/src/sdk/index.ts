/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * The setup wizard's SDK, published to the page as `@hryvinskyi/datalayer-setup`.
 *
 * It is the one surface the wizard's shell and every step plugin import: the contexts and hooks that read the
 * page's state, the domain model and its rules, the JSON client with the wizard's request rules, and the
 * composition pieces the shell's entry point wires. The page loads it once and every bundle imports it through the
 * bare specifier, so the context a plugin's hook reads is the one the shell provides. A file that imported any of
 * this by relative path would carry its own copy, and its hooks would find no provider.
 *
 * A step plugin is an ES module whose default export is `register(sdk: SetupSdk): void`; through `sdk` it adds
 * steps, required-value rules, and the server-delivery answer. It calls its own endpoints with `useJsonClient()`
 * and builds its step from the UI kit exported here, so every step looks and behaves alike.
 *
 * Errors are recognised by name and shape (`isRequestError`, `isContractError`, `error.name`), never by
 * `instanceof`: a class reached from another bundle is not the class this file defines.
 */

/* Domain: the model and its rules. */
export * from '../domain/brand.ts';
export * from '../domain/connection.ts';
export * from '../domain/core-keys.ts';
export * from '../domain/core-steps.ts';
export * from '../domain/diff.ts';
export * from '../domain/draft.ts';
export * from '../domain/events.ts';
export * from '../domain/inheritance.ts';
export * from '../domain/mode.ts';
export * from '../domain/order-value.ts';
export * from '../domain/origin.ts';
export * from '../domain/preview-store.ts';
export * from '../domain/result.ts';
export * from '../domain/scope.ts';
export * from '../domain/server-delivery.ts';
export * from '../domain/setting.ts';
export * from '../domain/setup-state.ts';
export * from '../domain/steps.ts';
export * from '../domain/validation.ts';
export * from '../domain/view.ts';

/* Application: what the server answers, request failures, draft values for requests, the wizard store. */
export type { JsonObject, JsonValue, PreviewResponse, ProductHit, SaveResponse, SaveResult, TestResult } from '../application/responses.ts';
export type { Logger, Navigator, PreviewKind, PreviewRequest, SetupGateway, WireDraftValue } from '../application/ports.ts';
export { failureOf, isRequestError, RequestError, type RequestErrorKind, type RequestFailure } from '../application/request-error.ts';
export { draftValues, previewKeys, previewRequestOf, type PreviewChoice } from '../application/draft-values.ts';
export { failedResults, type SaveOutcome } from '../application/save-all.ts';
export { saveBlockers, type SaveBlocker, type StepCheck } from '../application/save-readiness.ts';
export type { Session, SessionEndpoints, SessionLinks, SessionSource } from '../application/session.ts';
export { isSaving, type FieldKey, type SaveFailure, type SaveStatus, type WizardAction, type WizardActions, type WizardState } from '../application/wizard-store.ts';

/* Adapters: the wire contract and the JSON client. */
export { ContractError, isContractError, parsePageConfig, parseSession, parseTestResult, sessionOf, type PageConfig, type PageEndpoints, type PluginReference } from '../adapters/contract.ts';
export { createJsonClient, DEFAULT_DEADLINE_MS, type Fetch, type HttpResponse, type JsonClient, type JsonClientOptions, type JsonRequestOptions } from '../adapters/json-client.ts';
export { createBrowserNavigator, type BrowserWindow } from '../adapters/browser-navigator.ts';

/* Composition: the runtime, plugin registration, steps, the provider. */
export { applyPlugin, createWizardRuntime, type PluginRegister, type RuntimeDependencies, type SetupSdk, type WizardRuntime } from './runtime.ts';
export { StepTakenError, type StepBehaviour, type StepContribution, type StepSummaryContext } from './steps.ts';
export { WizardProvider, type WizardProviderProps } from './context.tsx';

/* Wording. */
export type { PhraseParam, Translator } from '../ui/i18n/translator.ts';

/* Hooks. */
export { useEditLock, useWizard, type WizardBinding } from '../ui/hooks/use-wizard.ts';
export { useExtensionData, useJsonClient, useLogger, useSteps, useT, type StepsBinding } from '../ui/hooks/use-runtime.ts';
export { useChangeCount, type Subscribe } from '../ui/hooks/use-change-count.ts';
export { useSession, type SessionBinding } from '../ui/hooks/use-session.ts';
export { useSaveBlockers, type StepBlocker } from '../ui/hooks/use-save-blockers.ts';
export { useScope, useSetting, type ScopeBinding, type SettingBinding } from '../ui/hooks/use-setting.ts';
export { useEventsSetting, type EventsSettingBinding } from '../ui/hooks/use-events-setting.ts';
export { useServerDelivery } from '../ui/hooks/use-server-delivery.ts';
export { LEAVE_PHRASE, useLeaveGuard, type LeaveGuard } from '../ui/hooks/use-leave-guard.ts';
export { useSave, type SaveBinding } from '../ui/hooks/use-save.ts';
export { DEBOUNCE_MS, usePreview, useProductSearch, type PreviewState, type RequestTiming } from '../ui/hooks/use-preview.ts';
export type { Remote } from '../ui/hooks/use-latest-request.ts';
export { useStepNavigation, type StepNavigation, type StepView } from '../ui/hooks/use-step-navigation.ts';
export { usePageLinks, type PageLinks } from '../ui/hooks/use-page-links.ts';

/* The UI kit: the frame's parts and the controls every step composes. */
export { Badge, type BadgeProps, type BadgeVariant } from '../ui/kit/Badge.tsx';
export { Button, DisclosureButton, ExternalLink, type ButtonProps, type ButtonVariant, type DisclosureButtonProps, type ExternalLinkProps } from '../ui/kit/Button.tsx';
export { Card, Columns, Panel, type CardProps, type ColumnsProps, type PanelProps } from '../ui/kit/Card.tsx';
export { describedBy, FieldRow, fieldIds, SettingField, settingControlId, type FieldControl, type FieldIds, type FieldRowProps, type SettingFieldProps } from '../ui/kit/FieldRow.tsx';
export { Footer, type FooterProps } from '../ui/kit/Footer.tsx';
export { FrameHeader, type FrameHeaderProps } from '../ui/kit/FrameHeader.tsx';
export { Icon, ICON_NAMES, iconOr, isIconName, type IconName, type IconProps, type IconSize } from '../ui/kit/icons.tsx';
export { OriginLine, OriginNotice, type OriginLineProps, type OriginNoticeProps } from '../ui/kit/OriginLine.tsx';
export { MessageStrip, Notice, type MessageAction, type MessageRole, type MessageStripProps, type NoticeProps, type Tone } from '../ui/kit/Notice.tsx';
export { RadioCards, type RadioCardsProps, type RadioOption } from '../ui/kit/RadioCards.tsx';
export { ScopeBar, type ScopeBarProps } from '../ui/kit/ScopeBar.tsx';
export { SelectInput, type SelectInputProps, type SelectOption } from '../ui/kit/SelectInput.tsx';
export { StatusPanel, type PanelState, type StatusLine, type StatusPanelProps } from '../ui/kit/StatusPanel.tsx';
export { StepHeading, type StepHeadingProps } from '../ui/kit/StepHeading.tsx';
export { Stepper, type StepperProps } from '../ui/kit/Stepper.tsx';
export { Switch, type SwitchProps } from '../ui/kit/Switch.tsx';
export { SecretInput, TextInput, type ControlWidth, type SecretInputProps, type TextInputProps } from '../ui/kit/TextInput.tsx';
