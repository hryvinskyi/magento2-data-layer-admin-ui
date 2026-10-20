<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Api\Events;

use Hryvinskyi\DataLayer\Api\Data\KnownEventInterface;

/**
 * Names the group an event is listed under in the admin
 *
 * @api
 */
interface EventGroupLabelInterface
{
    /**
     * Get the label of the group an event is listed under
     *
     * @param KnownEventInterface $event
     * @return string The group its module named, or a translated "Other" when it named none
     */
    public function labelOf(KnownEventInterface $event): string;
}
