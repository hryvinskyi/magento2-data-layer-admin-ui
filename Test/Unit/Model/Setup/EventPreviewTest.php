<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Test\Unit\Model\Setup;

use Hryvinskyi\DataLayer\Api\Config\DraftSettingsInterface;
use Hryvinskyi\DataLayer\Api\PriceVisibilityOverrideInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\Data\PreviewOutcomeInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\InvalidSetupRequestException;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\PreviewDraftInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\PreviewEventModifiersInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\PreviewKindInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\ScopeTreeInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\StoreViewEmulationInterface;
use Hryvinskyi\DataLayerAdminUi\Model\Setup\Data\PreviewOutcome;
use Hryvinskyi\DataLayerAdminUi\Model\Setup\EventPreview;
use Hryvinskyi\DataLayerAdminUi\Model\Setup\StoreViewCheck;
use Hryvinskyi\DataLayerApi\Api\Data\EventInterface;
use Magento\Framework\Phrase;
use Magento\Framework\Phrase\RendererInterface;
use PHPUnit\Framework\TestCase;

/**
 * The preview checks what the browser sent, then runs the kind asked for inside the drafted settings, the viewer's
 * price-visibility answer and the store view's emulation, closes all three whatever happens, and reads its reason in
 * the admin's language
 */
class EventPreviewTest extends TestCase
{
    /**
     * What happened, in order
     *
     * @var CallLog
     */
    private CallLog $log;

    /**
     * The renderer phrases had before a test
     *
     * @var RendererInterface|null
     */
    private ?RendererInterface $adminRenderer = null;

    /**
     * @inheritDoc
     */
    protected function setUp(): void
    {
        $this->log = new CallLog();
        $this->adminRenderer = Phrase::getRenderer();
    }

    /**
     * @inheritDoc
     */
    protected function tearDown(): void
    {
        if ($this->adminRenderer !== null) {
            Phrase::setRenderer($this->adminRenderer);
        }
    }

    /**
     * The kind runs with the drafted settings, the viewer's answer and the store view's emulation all open, opened in
     * that order and closed in reverse; a sent event comes back as the page pushes it
     *
     * @return void
     */
    public function testKindRunsInsideTheDraftTheAnswerAndTheEmulation(): void
    {
        $event = $this->createMock(EventInterface::class);
        $event->method('toDataLayer')->willReturn(['event' => 'view_item', 'ecommerce' => ['value' => 9.5]]);
        $preview = $this->preview(['view_item' => $this->kind('view_item', new PreviewOutcome('sent', $event))]);

        $answer = $preview->preview(2, 'view_item', 5, false, ['enabled' => true]);

        self::assertSame(
            ['status' => 'sent', 'event' => ['event' => 'view_item', 'ecommerce' => ['value' => 9.5]]],
            $answer
        );
        self::assertSame(
            [
                'draft {"enabled":true}',
                'draft opened {"section\/general\/enabled":"1"}',
                'prices visible: no',
                'emulating store view 2',
                'view_item for store view 2, product 5',
                'modifiers on the sent outcome',
                'emulation stopped',
                'answer cleared',
                'draft closed',
            ],
            $this->log->entries()
        );
    }

    /**
     * What the event modifiers make of the kind's outcome is what the preview answers
     *
     * @return void
     */
    public function testModifiersHaveTheLastWord(): void
    {
        $event = $this->createMock(EventInterface::class);
        $preview = $this->preview(
            ['view_item' => $this->kind('view_item', new PreviewOutcome('sent', $event))],
            new PreviewOutcome('not_sent', null, new Phrase('Dropped by a modifier.'))
        );

        $answer = $preview->preview(2, 'view_item', 5, true, []);

        self::assertSame(['status' => 'not_sent', 'reason' => 'Dropped by a modifier.'], $answer);
    }

    /**
     * The kind asked for is the one that runs
     *
     * @return void
     */
    public function testKindIsTakenFromThePool(): void
    {
        $preview = $this->preview([
            'view_item' => $this->kind('view_item', new PreviewOutcome('not_sent', null, new Phrase('Not this one.'))),
            'purchase' => $this->kind('purchase', new PreviewOutcome('unavailable', null, new Phrase('No orders.'))),
        ]);

        $answer = $preview->preview(1, 'purchase', null, true, []);

        self::assertSame(['status' => 'unavailable', 'reason' => 'No orders.'], $answer);
        self::assertContains('purchase for store view 1, no product', $this->log->entries());
        self::assertNotContains('view_item for store view 1, no product', $this->log->entries());
    }

    /**
     * A reason made while the store view is emulated reads in the admin's language, not the store view's
     *
     * @return void
     */
    public function testReasonReadsInTheAdminsLanguage(): void
    {
        $preview = $this->preview([
            'view_item' => $this->kind('view_item', new PreviewOutcome('not_sent', null, __('Tracking is off.'))),
        ]);

        $answer = $preview->preview(2, 'view_item', 5, true, []);

        self::assertSame(['status' => 'not_sent', 'reason' => 'Tracking is off.'], $answer);
    }

    /**
     * A kind that is not registered is refused before anything is drafted, forced or emulated
     *
     * @return void
     */
    public function testUnknownKindIsRefusedBeforeAnythingOpens(): void
    {
        $preview = $this->preview(['view_item' => $this->notSentKind()]);

        try {
            $preview->preview(2, 'sample_server_event', null, true, []);
            self::fail('An unknown kind was previewed.');
        } catch (InvalidSetupRequestException $exception) {
            self::assertStringContainsString('sample_server_event', $exception->getMessage());
        }

        self::assertSame([], $this->log->entries());
    }

    /**
     * A store view that is not in the scope tree is refused before anything opens; a website id is not a store view
     *
     * @return void
     */
    public function testUnknownStoreViewIsRefusedBeforeAnythingOpens(): void
    {
        $preview = $this->preview(['view_item' => $this->notSentKind()]);

        foreach ([7, 3] as $storeId) {
            try {
                $preview->preview($storeId, 'view_item', 5, true, []);
                self::fail(sprintf('Store view %d was previewed.', $storeId));
            } catch (InvalidSetupRequestException $exception) {
                self::assertSame(sprintf('No store view has the id %d.', $storeId), $exception->getMessage());
                self::assertSame([], $this->log->entries());
            }
        }
    }

    /**
     * Settings the wizard does not know are refused before anything opens
     *
     * @return void
     */
    public function testInvalidSettingsAreRefusedBeforeAnythingOpens(): void
    {
        $preview = $this->preview(['view_item' => $this->notSentKind()]);

        try {
            $preview->preview(2, 'view_item', 5, true, ['unknown' => 'x']);
            self::fail('Unknown settings were drafted.');
        } catch (InvalidSetupRequestException) {
            self::assertSame(['draft {"unknown":"x"}'], $this->log->entries());
        }
    }

    /**
     * A builder that throws leaves no emulation, no forced answer and no draft behind, and its exception reaches the
     * caller
     *
     * @return void
     */
    public function testEverythingClosesWhenTheBuilderThrows(): void
    {
        $failing = new class implements PreviewKindInterface {
            /**
             * @inheritDoc
             */
            public function preview(int $storeId, ?int $productId): PreviewOutcomeInterface
            {
                throw new \RuntimeException('builder failed');
            }
        };
        $preview = $this->preview(['view_item' => $failing]);

        try {
            $preview->preview(2, 'view_item', 5, true, []);
            self::fail('The exception was swallowed.');
        } catch (\RuntimeException $exception) {
            self::assertSame('builder failed', $exception->getMessage());
        }

        self::assertSame(
            ['emulation stopped', 'answer cleared', 'draft closed'],
            array_slice($this->log->entries(), -3)
        );
    }

    /**
     * An item of the pool that is not a kind of preview is refused when the preview is built
     *
     * @return void
     */
    public function testNonKindIsRefused(): void
    {
        $this->expectException(\InvalidArgumentException::class);

        $this->preview(['view_item' => new \stdClass()]);
    }

    /**
     * Build the preview over recording fakes
     *
     * @param array<mixed> $kinds
     * @param PreviewOutcomeInterface|null $modified What the modifiers answer; null to hand the outcome back as it is
     * @return EventPreview
     */
    private function preview(array $kinds, ?PreviewOutcomeInterface $modified = null): EventPreview
    {
        return new EventPreview(
            $this->previewDraft(),
            new StoreViewCheck($this->scopeTree()),
            $this->draftSettings(),
            $this->priceVisibility(),
            $this->emulation(),
            $this->modifiers($modified),
            $kinds
        );
    }

    /**
     * Modifiers that record what they were given and answer as told
     *
     * @param PreviewOutcomeInterface|null $modified What they answer; null to hand the outcome back as it is
     * @return PreviewEventModifiersInterface
     */
    private function modifiers(?PreviewOutcomeInterface $modified): PreviewEventModifiersInterface
    {
        return new class ($this->log, $modified) implements PreviewEventModifiersInterface {
            /**
             * @param CallLog $log
             * @param PreviewOutcomeInterface|null $modified
             */
            public function __construct(
                private readonly CallLog $log,
                private readonly ?PreviewOutcomeInterface $modified
            ) {
            }

            /**
             * @inheritDoc
             */
            public function apply(PreviewOutcomeInterface $outcome): PreviewOutcomeInterface
            {
                $this->log->add('modifiers on the ' . str_replace('_', '-', $outcome->getStatus()) . ' outcome');

                return $this->modified ?? $outcome;
            }
        };
    }

    /**
     * A `view_item` kind that records its run and answers that nothing is sent
     *
     * @return PreviewKindInterface
     */
    private function notSentKind(): PreviewKindInterface
    {
        return $this->kind('view_item', new PreviewOutcome('not_sent', null, new Phrase('Not sent.')));
    }

    /**
     * A kind that records its run and answers a fixed outcome
     *
     * @param string $name
     * @param PreviewOutcomeInterface $outcome
     * @return PreviewKindInterface
     */
    private function kind(string $name, PreviewOutcomeInterface $outcome): PreviewKindInterface
    {
        $log = $this->log;

        return new class ($name, $outcome, $log) implements PreviewKindInterface {
            /**
             * @param string $name
             * @param PreviewOutcomeInterface $outcome
             * @param CallLog $log
             */
            public function __construct(
                private readonly string $name,
                private readonly PreviewOutcomeInterface $outcome,
                private readonly CallLog $log
            ) {
            }

            /**
             * @inheritDoc
             */
            public function preview(int $storeId, ?int $productId): PreviewOutcomeInterface
            {
                $this->log->add(sprintf(
                    '%s for store view %d, %s',
                    $this->name,
                    $storeId,
                    $productId === null ? 'no product' : 'product ' . $productId
                ));

                return $this->outcome;
            }
        };
    }

    /**
     * A draft conversion that records what it was given, refuses a key named `unknown` and drafts `enabled` as a
     * flag
     *
     * @return PreviewDraftInterface
     */
    private function previewDraft(): PreviewDraftInterface
    {
        $log = $this->log;

        return new class ($log) implements PreviewDraftInterface {
            /**
             * @param CallLog $log
             */
            public function __construct(private readonly CallLog $log)
            {
            }

            /**
             * @inheritDoc
             */
            public function toDraft(array $settings): array
            {
                $this->log->add('draft ' . json_encode($settings === [] ? new \stdClass() : $settings));
                if (isset($settings['unknown'])) {
                    throw new InvalidSetupRequestException(
                        new Phrase('No wizard setting is registered under "%1".', ['unknown'])
                    );
                }

                return isset($settings['enabled']) ? ['section/general/enabled' => '1'] : [];
            }
        };
    }

    /**
     * A scope tree with one website and its store views 1 and 2
     *
     * @return ScopeTreeInterface
     */
    private function scopeTree(): ScopeTreeInterface
    {
        return new class implements ScopeTreeInterface {
            /**
             * @inheritDoc
             */
            public function getScopes(): array
            {
                return [
                    ['id' => 'default', 'type' => 'default', 'name' => 'All', 'code' => 'default', 'parent' => null],
                    ['id' => 'website:3', 'type' => 'website', 'name' => 'W', 'code' => 'w', 'parent' => 'default'],
                    ['id' => 'store:1', 'type' => 'store', 'name' => 'One', 'code' => 'one', 'parent' => 'website:3'],
                    ['id' => 'store:2', 'type' => 'store', 'name' => 'Two', 'code' => 'two', 'parent' => 'website:3'],
                ];
            }
        };
    }

    /**
     * Drafted settings that record when they open and close
     *
     * @return DraftSettingsInterface
     */
    private function draftSettings(): DraftSettingsInterface
    {
        $log = $this->log;

        return new class ($log) implements DraftSettingsInterface {
            /**
             * @param CallLog $log
             */
            public function __construct(private readonly CallLog $log)
            {
            }

            /**
             * @inheritDoc
             */
            public function withDraft(array $values, callable $work): mixed
            {
                $this->log->add('draft opened ' . json_encode($values === [] ? new \stdClass() : $values));
                try {
                    return $work();
                } finally {
                    $this->log->add('draft closed');
                }
            }
        };
    }

    /**
     * A price-visibility override that records the answer it forces and when it is cleared
     *
     * @return PriceVisibilityOverrideInterface
     */
    private function priceVisibility(): PriceVisibilityOverrideInterface
    {
        $log = $this->log;

        return new class ($log) implements PriceVisibilityOverrideInterface {
            /**
             * @param CallLog $log
             */
            public function __construct(private readonly CallLog $log)
            {
            }

            /**
             * @inheritDoc
             */
            public function withAnswer(bool $visible, callable $work): mixed
            {
                $this->log->add('prices visible: ' . ($visible ? 'yes' : 'no'));
                try {
                    return $work();
                } finally {
                    $this->log->add('answer cleared');
                }
            }
        };
    }

    /**
     * An emulation that records itself and, like the real one, renders phrases in the store view's language while
     * it runs
     *
     * @return StoreViewEmulationInterface
     */
    private function emulation(): StoreViewEmulationInterface
    {
        $log = $this->log;
        $storeLanguage = new class implements RendererInterface {
            /**
             * Render every phrase as text in the store view's language
             *
             * @param array<mixed> $source
             * @param array<mixed> $arguments
             * @return string
             */
            public function render(array $source, array $arguments)
            {
                return 'in the store view language';
            }
        };

        return new class ($log, $storeLanguage) implements StoreViewEmulationInterface {
            /**
             * @param CallLog $log
             * @param RendererInterface $storeLanguage
             */
            public function __construct(
                private readonly CallLog $log,
                private readonly RendererInterface $storeLanguage
            ) {
            }

            /**
             * @inheritDoc
             */
            public function run(int $storeId, callable $work): mixed
            {
                $adminLanguage = Phrase::getRenderer();
                Phrase::setRenderer($this->storeLanguage);
                $this->log->add('emulating store view ' . $storeId);
                try {
                    return $work();
                } finally {
                    Phrase::setRenderer($adminLanguage);
                    $this->log->add('emulation stopped');
                }
            }
        };
    }
}
