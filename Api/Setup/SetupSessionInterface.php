<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Api\Setup;

/**
 * What the setup wizard's page needs to carry on in the admin session it is answered in: the session's form key and
 * every admin address the page configuration carries, built for that session
 *
 * When the session the page was opened in ends and the person signs in again in another tab, the page's form key and
 * secret-keyed addresses no longer work; reading these again lets the page continue without being reloaded, so no
 * unsaved edit is lost.
 *
 * @phpstan-import-type RequestEndpoints from SetupUrlsInterface
 * @phpstan-import-type Links from SetupUrlsInterface
 * @phpstan-type Session array{formKey: string, endpoints: RequestEndpoints, links: Links}
 * @api
 */
interface SetupSessionInterface
{
    /**
     * Describe the current session's form key and addresses
     *
     * @return Session `links` keyed by scope id, one address for every scope of the scope tree
     * @throws \Magento\Framework\Exception\LocalizedException When no form key can be made
     */
    public function describe(): array;
}
