<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Model;

use Hryvinskyi\DataLayerAdminUi\Api\ServerDeliveryStateInterface;

/**
 * The answer while no module delivers server events: nothing routed to the server is delivered
 */
class NoServerDelivery implements ServerDeliveryStateInterface
{
    /**
     * @inheritDoc
     */
    public function isEnabled(?int $websiteId): bool
    {
        return false;
    }

    /**
     * @inheritDoc
     */
    public function getSettingsGroupPath(): ?string
    {
        return null;
    }
}
