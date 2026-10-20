<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Test\Unit\Model\Setup\Data;

use Hryvinskyi\DataLayerAdminUi\Model\Setup\Data\PreviewOutcome;
use Hryvinskyi\DataLayerApi\Api\Data\EventInterface;
use Magento\Framework\Phrase;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/**
 * A preview outcome is sent with an event, or not sent or unavailable with a reason, and nothing else
 */
class PreviewOutcomeTest extends TestCase
{
    /**
     * A sent outcome carries its event and refuses to give a reason
     *
     * @return void
     */
    public function testSentOutcomeCarriesItsEvent(): void
    {
        $event = $this->createMock(EventInterface::class);
        $outcome = new PreviewOutcome('sent', $event);

        self::assertSame('sent', $outcome->getStatus());
        self::assertSame($event, $outcome->getEvent());
        $this->expectException(\LogicException::class);
        $outcome->getReason();
    }

    /**
     * A not-sent or unavailable outcome carries its reason and refuses to give an event
     *
     * @return void
     */
    public function testOtherOutcomesCarryTheirReason(): void
    {
        $reason = new Phrase('Tracking is off.');
        $notSent = new PreviewOutcome('not_sent', null, $reason);
        $unavailable = new PreviewOutcome('unavailable', null, $reason);

        self::assertSame('not_sent', $notSent->getStatus());
        self::assertSame('unavailable', $unavailable->getStatus());
        self::assertSame($reason, $notSent->getReason());
        $this->expectException(\LogicException::class);
        $unavailable->getEvent();
    }

    /**
     * An unknown status, a sent outcome without an event or with a reason, and any other outcome with an event or
     * without a reason are refused
     *
     * @param string $status
     * @param bool $withEvent
     * @param bool $withReason
     * @return void
     */
    #[DataProvider('mismatches')]
    public function testMismatchIsRefused(string $status, bool $withEvent, bool $withReason): void
    {
        $this->expectException(\InvalidArgumentException::class);

        new PreviewOutcome(
            $status,
            $withEvent ? $this->createMock(EventInterface::class) : null,
            $withReason ? new Phrase('A reason.') : null
        );
    }

    /**
     * Outcomes that cannot exist
     *
     * @return array<string, array{string, bool, bool}>
     */
    public static function mismatches(): array
    {
        return [
            'unknown status' => ['maybe', false, true],
            'sent without an event' => ['sent', false, false],
            'sent with a reason' => ['sent', true, true],
            'not sent with an event' => ['not_sent', true, true],
            'not sent without a reason' => ['not_sent', false, false],
            'unavailable without a reason' => ['unavailable', false, false],
        ];
    }
}
