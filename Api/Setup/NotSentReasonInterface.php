<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Api\Setup;

use Hryvinskyi\DataLayerApi\Api\Data\ItemSubjectInterface;
use Magento\Framework\Phrase;

/**
 * Says why an event builder built nothing, in the words the setup wizard's preview shows
 *
 * The reasons are checked in a fixed order, against the settings as they read right now (drafted ones included), and
 * the first that holds is the answer: tracking is off for the store view; the event is switched off there; a product
 * of the event has a price the viewer may not see and the store view sends no ecommerce event then; otherwise the
 * product or order has no item the data layer reports.
 *
 * @api
 */
interface NotSentReasonInterface
{
    /**
     * Explain why an event was not built
     *
     * @param string $eventName The GA4 event name
     * @param int $storeId The store view the event was built for
     * @param list<ItemSubjectInterface> $subjects What the event's items were built from, when hidden prices can stop
     *     the event; empty when they cannot
     * @return Phrase
     */
    public function explain(string $eventName, int $storeId, array $subjects = []): Phrase;
}
