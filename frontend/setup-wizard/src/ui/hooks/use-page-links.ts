/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * The admin pages the wizard links to, at the scope being edited. The server builds one URL per scope (admin URLs
 * carry a secret key), so the browser only picks; a scope the server sent no URL for has no link. The links follow
 * the session: once it is renewed, they are the renewed ones.
 */
import { useSession } from './use-session.ts';
import { useWizard } from './use-wizard.ts';

export interface PageLinks {
    /** The advanced settings page at the current scope. */
    readonly advanced: string | null;
    /** Where Close leads at the current scope. */
    readonly close: string | null;
}

export function usePageLinks(): PageLinks {
    const { session } = useSession();
    const { state } = useWizard();
    return {
        advanced: session.links.advanced.get(state.scope) ?? null,
        close: session.links.close.get(state.scope) ?? null,
    };
}
