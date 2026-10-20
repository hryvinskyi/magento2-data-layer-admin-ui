<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Test\Unit\Model\Setup\Preview;

use Hryvinskyi\DataLayer\Api\ConfigInterface;
use Hryvinskyi\DataLayer\Api\HiddenPriceDecision;
use Hryvinskyi\DataLayer\Api\HiddenPricePolicyInterface;
use Hryvinskyi\DataLayerAdminUi\Model\Setup\Preview\NotSentReason;
use Hryvinskyi\DataLayerApi\Api\Data\ItemSubjectInterface;
use PHPUnit\Framework\TestCase;

/**
 * Why an event was not built is the first of: tracking off, the event switched off, a hidden price the store view
 * skips the event for, and otherwise no item to report
 */
class NotSentReasonTest extends TestCase
{
    /**
     * Tracking off for the store view comes first, even when the event is also switched off and its price hidden
     *
     * @return void
     */
    public function testTrackingOffComesFirst(): void
    {
        $reason = $this->reason(false, ['view_item'], HiddenPriceDecision::SkipEvent)
            ->explain('view_item', 2, [$this->subject()]);

        self::assertSame('Tracking is off for this store view.', (string) $reason);
    }

    /**
     * An event switched off for the store view comes next, even when its price is hidden
     *
     * @return void
     */
    public function testEventSwitchedOffComesNext(): void
    {
        $reason = $this->reason(true, ['add_to_cart', 'view_item'], HiddenPriceDecision::SkipEvent)
            ->explain('view_item', 2, [$this->subject()]);

        self::assertSame('This event is switched off for this store view.', (string) $reason);
    }

    /**
     * A hidden price the store view skips the event for comes after
     *
     * @return void
     */
    public function testHiddenPriceSkippingTheEventComesAfter(): void
    {
        $reason = $this->reason(true, ['add_to_cart'], HiddenPriceDecision::SkipEvent)
            ->explain('view_item', 2, [$this->subject()]);

        self::assertSame(
            'Prices are hidden from this visitor, and this store view sends no ecommerce event then.',
            (string) $reason
        );
    }

    /**
     * Prices sent without money, or no subjects to judge, leave only the missing item as the reason
     *
     * @return void
     */
    public function testOtherwiseThereIsNoItem(): void
    {
        $fallback = 'This product or order has no item the data layer reports.';

        $omitMoney = $this->reason(true, [], HiddenPriceDecision::OmitMoney);

        self::assertSame($fallback, (string) $omitMoney->explain('view_item', 2, [$this->subject()]));
        self::assertSame(
            $fallback,
            (string) $this->reason(true, [], HiddenPriceDecision::SkipEvent)->explain('purchase', 2)
        );
    }

    /**
     * Build the explainer over a store view's settings and the hidden-price decision
     *
     * @param bool $enabled
     * @param list<string> $disabledEvents
     * @param HiddenPriceDecision $decision
     * @return NotSentReason
     */
    private function reason(bool $enabled, array $disabledEvents, HiddenPriceDecision $decision): NotSentReason
    {
        $config = $this->createMock(ConfigInterface::class);
        $config->method('isEnabled')->with(2)->willReturn($enabled);
        $config->method('getDisabledEvents')->with(2)->willReturn($disabledEvents);
        $policy = $this->createMock(HiddenPricePolicyInterface::class);
        $policy->method('decide')->willReturn($decision);

        return new NotSentReason($config, $policy);
    }

    /**
     * An item subject
     *
     * @return ItemSubjectInterface
     */
    private function subject(): ItemSubjectInterface
    {
        return $this->createMock(ItemSubjectInterface::class);
    }
}
