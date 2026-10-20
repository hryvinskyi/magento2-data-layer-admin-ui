<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Test\Unit\Model\Setup\Preview;

use Hryvinskyi\DataLayer\Model\EventModifierPipeline;
use Hryvinskyi\DataLayerAdminUi\Model\Setup\Data\PreviewOutcome;
use Hryvinskyi\DataLayerAdminUi\Model\Setup\Preview\PreviewEventModifiers;
use Hryvinskyi\DataLayerAdminUi\Test\Unit\Model\Setup\RecordingLogger;
use Hryvinskyi\DataLayerApi\Api\Data\EventInterface;
use Hryvinskyi\DataLayerApi\Api\EventModifierInterface;
use Magento\Framework\Phrase;
use PHPUnit\Framework\TestCase;

/**
 * A previewed event goes through the same modifier pipeline a page's events go through: a modifier's change shows in
 * the preview, and an event a modifier drops or fails on is shown as not sent
 */
class PreviewEventModifiersTest extends TestCase
{
    /**
     * Each modifier sees the event in turn, and the preview shows the last one's result
     *
     * @return void
     */
    public function testModifiedEventIsWhatThePreviewShows(): void
    {
        $original = $this->createMock(EventInterface::class);
        $renamed = $this->createMock(EventInterface::class);
        $seen = [];
        $modifiers = new PreviewEventModifiers(
            new EventModifierPipeline([
                'record' => $this->modifier(static function (EventInterface $event) use (&$seen): EventInterface {
                    $seen[] = $event;

                    return $event;
                }),
                'replace' => $this->modifier(static fn (EventInterface $event): EventInterface => $renamed),
            ]),
            new PreviewOutcomeFactoryStub(),
            new RecordingLogger()
        );

        $outcome = $modifiers->apply(new PreviewOutcome('sent', $original));

        self::assertSame([$original], $seen);
        self::assertSame('sent', $outcome->getStatus());
        self::assertSame($renamed, $outcome->getEvent());
    }

    /**
     * An event a modifier drops is not sent, and the reason says a modifier dropped it
     *
     * @return void
     */
    public function testDroppedEventIsNotSent(): void
    {
        $modifiers = new PreviewEventModifiers(
            new EventModifierPipeline([
                'drop' => $this->modifier(static fn (EventInterface $event): ?EventInterface => null),
            ]),
            new PreviewOutcomeFactoryStub(),
            new RecordingLogger()
        );

        $outcome = $modifiers->apply(new PreviewOutcome('sent', $this->createMock(EventInterface::class)));

        self::assertSame('not_sent', $outcome->getStatus());
        self::assertSame(
            'An event modifier drops this event, so the page sends nothing.',
            (string) $outcome->getReason()
        );
    }

    /**
     * A modifier that fails leaves the event out, as a page does, and the failure is logged with the event's name
     *
     * @return void
     */
    public function testFailingModifierLeavesTheEventOutAndIsLogged(): void
    {
        $logger = new RecordingLogger();
        $event = $this->createMock(EventInterface::class);
        $event->method('getName')->willReturn('view_item');
        $modifiers = new PreviewEventModifiers(
            new EventModifierPipeline(['fail' => $this->modifier(static function (): never {
                throw new \RuntimeException('modifier broke');
            })]),
            new PreviewOutcomeFactoryStub(),
            $logger
        );

        $outcome = $modifiers->apply(new PreviewOutcome('sent', $event));

        self::assertSame('not_sent', $outcome->getStatus());
        self::assertCount(1, $logger->records);
        self::assertSame('view_item', $logger->records[0]['context']['event'] ?? null);
    }

    /**
     * An outcome that sends nothing never reaches a modifier
     *
     * @return void
     */
    public function testOutcomeWithoutEventIsLeftAlone(): void
    {
        $ran = false;
        $modifiers = new PreviewEventModifiers(
            new EventModifierPipeline([
                'record' => $this->modifier(static function (EventInterface $event) use (&$ran): EventInterface {
                    $ran = true;

                    return $event;
                }),
            ]),
            new PreviewOutcomeFactoryStub(),
            new RecordingLogger()
        );
        $outcome = new PreviewOutcome('unavailable', null, new Phrase('No orders.'));

        self::assertSame($outcome, $modifiers->apply($outcome));
        self::assertFalse($ran);
    }

    /**
     * A modifier that does what it is given
     *
     * @param \Closure $modify
     * @return EventModifierInterface
     */
    private function modifier(\Closure $modify): EventModifierInterface
    {
        return new class ($modify) implements EventModifierInterface {
            /**
             * @param \Closure $modify
             */
            public function __construct(private readonly \Closure $modify)
            {
            }

            /**
             * @inheritDoc
             */
            public function modify(EventInterface $event): ?EventInterface
            {
                $modified = ($this->modify)($event);

                return $modified instanceof EventInterface ? $modified : null;
            }
        };
    }
}
