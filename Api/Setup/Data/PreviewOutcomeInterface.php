<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Api\Setup\Data;

use Hryvinskyi\DataLayerApi\Api\Data\EventInterface;
use Magento\Framework\Phrase;

/**
 * What one event preview found: the event a page would send, or why it sends none, or why there is nothing to
 * preview
 *
 * A sent outcome carries the event and no reason; any other carries a reason and no event. The reason stays a phrase
 * until the caller reads it, so it is rendered in the language of whoever reads it, not in the language of the store
 * view the preview ran in.
 *
 * @api
 */
interface PreviewOutcomeInterface
{
    /**
     * The page sends the event
     */
    public const SENT = 'sent';

    /**
     * The page sends no event, for the reason given
     */
    public const NOT_SENT = 'not_sent';

    /**
     * There is nothing to preview, for the reason given
     */
    public const UNAVAILABLE = 'unavailable';

    /**
     * Get what the preview found
     *
     * @return 'sent'|'not_sent'|'unavailable'
     */
    public function getStatus(): string;

    /**
     * Get the event the page sends
     *
     * @return EventInterface
     * @throws \LogicException When the outcome is not a sent one
     */
    public function getEvent(): EventInterface;

    /**
     * Get why no event is sent, or why there is nothing to preview
     *
     * @return Phrase
     * @throws \LogicException When the outcome is a sent one
     */
    public function getReason(): Phrase;
}
