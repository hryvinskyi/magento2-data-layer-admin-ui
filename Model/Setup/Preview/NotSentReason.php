<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Model\Setup\Preview;

use Hryvinskyi\DataLayer\Api\ConfigInterface;
use Hryvinskyi\DataLayer\Api\HiddenPriceDecision;
use Hryvinskyi\DataLayer\Api\HiddenPricePolicyInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\NotSentReasonInterface;
use Magento\Framework\Phrase;

/**
 * Asks the same settings and the same hidden-price rule the event builders ask, in the order they ask them
 */
class NotSentReason implements NotSentReasonInterface
{
    /**
     * @param ConfigInterface $config
     * @param HiddenPricePolicyInterface $hiddenPricePolicy
     */
    public function __construct(
        private readonly ConfigInterface $config,
        private readonly HiddenPricePolicyInterface $hiddenPricePolicy
    ) {
    }

    /**
     * @inheritDoc
     */
    public function explain(string $eventName, int $storeId, array $subjects = []): Phrase
    {
        if (!$this->config->isEnabled($storeId)) {
            return __('Tracking is off for this store view.');
        }
        if (in_array($eventName, $this->config->getDisabledEvents($storeId), true)) {
            return __('This event is switched off for this store view.');
        }
        if ($subjects !== []
            && $this->hiddenPricePolicy->decide($subjects, $storeId) === HiddenPriceDecision::SkipEvent
        ) {
            return __('Prices are hidden from this visitor, and this store view sends no ecommerce event then.');
        }

        return __('This product or order has no item the data layer reports.');
    }
}
