<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Api\Setup;

/**
 * The admin addresses the setup wizard's browser code calls and goes to
 *
 * Admin addresses can carry a per-session secret key, so the browser never builds one: every address it needs,
 * including the configuration page at each scope it may leave to, is built here. The session address alone carries no
 * secret key, so the browser can still reach it once the session that issued the keys has ended; it hands out the new
 * session's addresses.
 *
 * @phpstan-import-type Scope from ScopeTreeInterface
 * @phpstan-type RequestEndpoints array{save: string, preview: string, products: string, session: string}
 * @phpstan-type Links array{advanced: array<string, string>, close: array<string, string>}
 * @phpstan-type Endpoints array{
 *     save: string,
 *     preview: string,
 *     products: string,
 *     session: string,
 *     advanced: array<string, string>,
 *     close: array<string, string>
 * }
 * @api
 */
interface SetupUrlsInterface
{
    /**
     * Get the wizard's endpoints and, for every scope, where its Advanced settings and Close lead
     *
     * The request endpoints and the links together, as the page configuration carries them.
     *
     * @param list<Scope> $scopes
     * @return Endpoints `advanced` and `close` keyed by scope id, one address for each scope given
     * @throws \InvalidArgumentException When a scope's id is not a scope id
     */
    public function getEndpoints(array $scopes): array;

    /**
     * Get the addresses the browser sends its requests to
     *
     * @return RequestEndpoints
     */
    public function getRequestEndpoints(): array;

    /**
     * Get, for every scope, where its Advanced settings and Close lead
     *
     * Both lead to the data layer's configuration section at that scope.
     *
     * @param list<Scope> $scopes
     * @return Links Each keyed by scope id, one address for each scope given
     * @throws \InvalidArgumentException When a scope's id is not a scope id
     */
    public function getLinks(array $scopes): array;
}
