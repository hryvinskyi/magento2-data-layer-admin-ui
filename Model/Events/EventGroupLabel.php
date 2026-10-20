<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Model\Events;

use Hryvinskyi\DataLayer\Api\Data\KnownEventInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Events\EventGroupLabelInterface;

/**
 * Lists an event under the group its module named, or under "Other" when it named none
 */
class EventGroupLabel implements EventGroupLabelInterface
{
    /**
     * @inheritDoc
     */
    public function labelOf(KnownEventInterface $event): string
    {
        return $event->getGroup() !== '' ? $event->getGroup() : (string) __('Other');
    }
}
