/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * Where a value comes from at the scope being edited, in the two forms the wizard shows it:
 *
 * - the origin line: a chip ("Set for this store view", "Inherited from Default", the lock message) with the one
 *   action that changes it — "Override here" on an inherited value, "Use inherited value" on an own one. A field
 *   shows it under its control; a card or table shows it in its head, beside the title.
 * - the origin notice: the line that sits where a disabled part starts and says why it cannot be changed —
 *   inherited (with "Override here"), fixed by the deployment configuration, or set at a wider scope. It shows
 *   nothing while the value can be changed here.
 *
 * Which origin a value has is the domain's (`domain/origin.ts`); this file only words it.
 */
import type { JSX } from 'preact';
import { BUILT_IN, type ValueSource } from '../../domain/inheritance.ts';
import type { FieldOrigin, FieldOriginKind } from '../../domain/origin.ts';
import type { ScopeId, ScopeTree } from '../../domain/scope.ts';
import type { Translator } from '../i18n/translator.ts';
import { useT } from '../hooks/use-runtime.ts';
import { useScope } from '../hooks/use-setting.ts';
import { Icon, type IconName } from './icons.tsx';
import { Notice } from './Notice.tsx';

type OriginAction = 'override' | 'inherit';

/** One origin, worded. */
interface OriginWording {
    readonly icon: IconName;
    readonly text: string;
    readonly action: OriginAction | null;
    /** The scope has its own value: the line is tinted like an override. */
    readonly own: boolean;
}

interface OriginContext {
    readonly translator: Translator;
    readonly tree: ScopeTree;
}

type OriginOf<K extends FieldOriginKind> = Extract<FieldOrigin, { readonly kind: K }>;

const scopeName = (tree: ScopeTree, id: ScopeId): string => tree.get(id).name;

/** How each origin reads as a line, and which action it offers. */
const ORIGIN_LINES: { readonly [K in FieldOriginKind]: (origin: OriginOf<K>, context: OriginContext) => OriginWording } = {
    locked: (origin) => ({ icon: 'lock', text: origin.message, action: null, own: false }),
    outOfReach: (origin, { translator, tree }) => ({
        icon: 'lock',
        text: origin.reach === 'website' && origin.target !== null
            ? translator.t('origin.reach.website', scopeName(tree, origin.target))
            : translator.t('origin.reach.default'),
        action: null,
        own: false,
    }),
    default: (origin, { translator, tree }) => {
        if (origin.overriders.length > 0) {
            const names = origin.overriders.map((id) => scopeName(tree, id));
            return {
                icon: 'public',
                text: translator.tn('origin.overridden', names.length, translator.list(names)),
                action: null,
                own: false,
            };
        }
        return {
            icon: 'public',
            text: origin.own ? translator.t('origin.default') : translator.t('origin.built_in'),
            action: null,
            own: false,
        };
    },
    own: (origin, { translator }) => ({ icon: 'edit', text: translator.t(`origin.${origin.scopeType}`), action: 'inherit', own: true }),
    inherited: (origin, { translator, tree }) => ({
        icon: 'south_east',
        text: origin.from === BUILT_IN
            ? translator.t('origin.inherited_built_in')
            : translator.t('origin.inherited', scopeName(tree, origin.from)),
        action: 'override',
        own: false,
    }),
};

function originWording<K extends FieldOriginKind>(origin: OriginOf<K> & { readonly kind: K }, context: OriginContext): OriginWording {
    const describe: (origin: OriginOf<K>, context: OriginContext) => OriginWording = ORIGIN_LINES[origin.kind];
    return describe(origin, context);
}

const ACTION_PHRASE = {
    override: 'action.override',
    inherit: 'action.inherit',
} as const satisfies Record<OriginAction, string>;

export interface OriginLineProps {
    readonly origin: FieldOrigin;
    /** Offered on an inherited value; left out, the line offers no action there. */
    readonly onOverride?: (() => void) | undefined;
    /** Offered on the scope's own value; left out, the line offers no action there. */
    readonly onInherit?: (() => void) | undefined;
}

export function OriginLine({ origin, onOverride, onInherit }: OriginLineProps): JSX.Element {
    const translator = useT();
    const { tree } = useScope();
    const line = originWording(origin, { translator, tree });
    const handlers = { override: onOverride, inherit: onInherit } as const satisfies Record<OriginAction, (() => void) | undefined>;
    const handler = line.action === null ? undefined : handlers[line.action];

    return (
        <div class="hdl-setup-origin-line">
            <span class={line.own ? 'hdl-setup-origin hdl-setup-origin--own' : 'hdl-setup-origin'}>
                <Icon name={line.icon} size={14} />
                <span>{line.text}</span>
            </span>
            {line.action === null || handler === undefined ? null : (
                <button type="button" class="hdl-setup-button hdl-setup-button--link hdl-setup-origin__action" onClick={handler}>
                    {translator.t(ACTION_PHRASE[line.action])}
                </button>
            )}
        </div>
    );
}

/** Why a value cannot be changed here, or null while it can. */
interface NoticeWording {
    readonly icon: IconName;
    readonly text: string;
    readonly override: boolean;
}

interface NoticeContext extends OriginContext {
    /** The name of the scope being edited. */
    readonly scopeLabel: string;
    /** Phrase key of the sentence explaining an inherited value: %1 the source, %2 the scope being edited. */
    readonly inheritedPhrase: string;
}

const sourceName = (source: ValueSource, { translator, tree }: OriginContext): string =>
    source === BUILT_IN ? translator.t('origin.source.built_in') : scopeName(tree, source);

/** What each origin explains where the disabled part starts; an origin that leaves the value editable explains nothing. */
const ORIGIN_NOTICES: {
    readonly [K in FieldOriginKind]: (origin: OriginOf<K>, context: NoticeContext) => NoticeWording | null
} = {
    locked: (origin, context) => ({ icon: 'lock', text: originWording(origin, context).text, override: false }),
    outOfReach: (origin, context) => ({ icon: 'lock', text: originWording(origin, context).text, override: false }),
    default: () => null,
    own: () => null,
    inherited: (origin, context) => ({
        icon: 'south_east',
        text: context.translator.t(context.inheritedPhrase, sourceName(origin.from, context), context.scopeLabel),
        override: true,
    }),
};

function noticeWording<K extends FieldOriginKind>(origin: OriginOf<K> & { readonly kind: K }, context: NoticeContext): NoticeWording | null {
    const describe: (origin: OriginOf<K>, context: NoticeContext) => NoticeWording | null = ORIGIN_NOTICES[origin.kind];
    return describe(origin, context);
}

/** The sentence an inherited value is explained with when the caller names none. */
const ORIGIN_INHERITED_PHRASE = 'origin.explain.inherited';

export interface OriginNoticeProps {
    readonly origin: FieldOrigin;
    /** Makes an inherited value the scope's own; the notice offers it as "Override here". */
    readonly onOverride: () => void;
    /**
     * Phrase key of the sentence explaining an inherited value, with %1 the scope it comes from (or the built-in
     * default) and %2 the scope being edited — so a step can say what overriding lets the person do.
     */
    readonly inheritedPhrase?: string | undefined;
}

export function OriginNotice({ origin, onOverride, inheritedPhrase = ORIGIN_INHERITED_PHRASE }: OriginNoticeProps): JSX.Element | null {
    const translator = useT();
    const { tree, scope } = useScope();
    const wording = noticeWording(origin, { translator, tree, scopeLabel: scope.name, inheritedPhrase });
    if (wording === null) {
        return null;
    }
    return (
        <Notice
            tone="info"
            muted
            icon={wording.icon}
            {...(wording.override ? { action: { label: translator.t(ACTION_PHRASE.override), onClick: onOverride } } : {})}
        >
            {wording.text}
        </Notice>
    );
}
