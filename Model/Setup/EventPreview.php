<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Model\Setup;

use Hryvinskyi\DataLayer\Api\Config\DraftSettingsInterface;
use Hryvinskyi\DataLayer\Api\PriceVisibilityOverrideInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\Data\PreviewOutcomeInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\EventPreviewInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\InvalidSetupRequestException;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\PreviewDraftInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\PreviewEventModifiersInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\PreviewKindInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\StoreViewCheckInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\StoreViewEmulationInterface;

/**
 * Runs the kind of preview asked for inside the drafted settings, the viewer's price-visibility answer and the store
 * view's storefront emulation, each opened in that order and each closed again whether the preview returns or throws;
 * a sent event goes through the store's event modifiers inside the emulation, as a page's events do before they are
 * pushed
 *
 * Everything the browser sent is checked before any of them opens: the kind against the registered ones (the `kinds`
 * argument, keyed by kind), the store view against the scope tree, and the settings against the wizard's settings.
 * A reason is rendered only after the emulation has ended, so it reads in the admin's language rather than the store
 * view's.
 */
class EventPreview implements EventPreviewInterface
{
    /**
     * @var array<string, PreviewKindInterface>
     */
    private readonly array $kinds;

    /**
     * @param PreviewDraftInterface $previewDraft
     * @param StoreViewCheckInterface $storeViewCheck
     * @param DraftSettingsInterface $draftSettings
     * @param PriceVisibilityOverrideInterface $priceVisibility
     * @param StoreViewEmulationInterface $emulation
     * @param PreviewEventModifiersInterface $modifiers
     * @param array<mixed> $kinds Each kind of preview, keyed by the kind the browser asks for
     * @throws \InvalidArgumentException When a kind is not a PreviewKindInterface
     */
    public function __construct(
        private readonly PreviewDraftInterface $previewDraft,
        private readonly StoreViewCheckInterface $storeViewCheck,
        private readonly DraftSettingsInterface $draftSettings,
        private readonly PriceVisibilityOverrideInterface $priceVisibility,
        private readonly StoreViewEmulationInterface $emulation,
        private readonly PreviewEventModifiersInterface $modifiers,
        array $kinds = []
    ) {
        $registered = [];
        foreach ($kinds as $code => $kind) {
            if (!$kind instanceof PreviewKindInterface) {
                throw new \InvalidArgumentException(sprintf(
                    'The event preview "%s" must implement %s.',
                    (string) $code,
                    PreviewKindInterface::class
                ));
            }
            $registered[(string) $code] = $kind;
        }
        $this->kinds = $registered;
    }

    /**
     * @inheritDoc
     */
    public function preview(int $storeId, string $kind, ?int $productId, bool $priceVisible, array $settings): array
    {
        $previewKind = $this->kinds[$kind] ?? throw new InvalidSetupRequestException(
            __('No event preview is registered under "%1".', $kind)
        );
        $this->storeViewCheck->assertExists($storeId);
        $draft = $this->previewDraft->toDraft($settings);

        $outcome = $this->draftSettings->withDraft(
            $draft,
            fn (): PreviewOutcomeInterface => $this->priceVisibility->withAnswer(
                $priceVisible,
                fn (): PreviewOutcomeInterface => $this->emulation->run(
                    $storeId,
                    fn (): PreviewOutcomeInterface => $this->modifiers->apply(
                        $previewKind->preview($storeId, $productId)
                    )
                )
            )
        );

        $status = $outcome->getStatus();
        if ($status === PreviewOutcomeInterface::SENT) {
            return ['status' => $status, 'event' => $outcome->getEvent()->toDataLayer()];
        }

        return ['status' => $status, 'reason' => (string) $outcome->getReason()];
    }
}
