/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * Keeps one step that fails to render from taking the wizard down: the failure goes to the log, the step's place
 * says that this step could not be shown, and the frame — header, scope, stepper, footer, every other step — keeps
 * working. Each step gets a boundary of its own, so opening another step starts clean.
 */
import type { ComponentChildren, JSX } from 'preact';
import { useErrorBoundary } from 'preact/hooks';
import { MessageStrip, useLogger, useT, type StepId } from '@hryvinskyi/datalayer-setup';

export interface StepBoundaryProps {
    readonly step: StepId;
    readonly children: ComponentChildren;
}

export function StepBoundary({ step, children }: StepBoundaryProps): JSX.Element {
    const { t } = useT();
    const logger = useLogger();
    const [failure]: readonly [unknown, () => void] = useErrorBoundary((error: unknown): void => {
        logger.error(`The setup step ${step} failed to render`, error);
    });
    return failure === undefined ? <>{children}</> : <MessageStrip tone="error">{t('step.failed')}</MessageStrip>;
}
