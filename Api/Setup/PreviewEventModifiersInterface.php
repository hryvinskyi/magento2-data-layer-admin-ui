<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Api\Setup;

use Hryvinskyi\DataLayerAdminUi\Api\Setup\Data\PreviewOutcomeInterface;

/**
 * Lets a preview's event go through the event modifiers every event of the store goes through before it reaches the
 * page, so the preview shows what a modifier changes too
 *
 * @api
 */
interface PreviewEventModifiersInterface
{
    /**
     * Apply the modifiers to a sent outcome's event
     *
     * An outcome that sends nothing is returned as it is. A modifier that drops the event, or fails on it, leaves it
     * off the page, so the outcome becomes one that sends nothing, saying why.
     *
     * @param PreviewOutcomeInterface $outcome
     * @return PreviewOutcomeInterface
     */
    public function apply(PreviewOutcomeInterface $outcome): PreviewOutcomeInterface;
}
