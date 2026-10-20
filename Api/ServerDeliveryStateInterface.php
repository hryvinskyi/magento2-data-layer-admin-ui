<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Api;

/**
 * Tells the event settings whether events routed to the server go anywhere
 *
 * An event routed to the server does nothing until a server-side delivery module is installed and switched on for
 * the website. Without such a module nothing is delivered and there are no settings to open; the module that
 * delivers server events replaces this answer with its own, naming the group of the configuration page where it is
 * switched on.
 *
 * @api
 */
interface ServerDeliveryStateInterface
{
    /**
     * Whether server-side delivery is on for a website
     *
     * @param int|null $websiteId Null for the default scope
     * @return bool
     */
    public function isEnabled(?int $websiteId): bool;

    /**
     * Get the group of the configuration page where server-side delivery is switched on
     *
     * @return string|null The group's path, its section and group ids (`section/group`); null when no module
     *     delivers server events
     */
    public function getSettingsGroupPath(): ?string;
}
