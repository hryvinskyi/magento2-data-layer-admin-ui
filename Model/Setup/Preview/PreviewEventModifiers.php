<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Model\Setup\Preview;

use Hryvinskyi\DataLayer\Api\EventModifierPipelineInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\Data\PreviewOutcomeInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\Data\PreviewOutcomeInterfaceFactory;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\PreviewEventModifiersInterface;
use Psr\Log\LoggerInterface;

/**
 * Runs a sent preview's event through the store's event modifier pipeline, the one a page's events go through
 *
 * A page leaves out an event a modifier fails on and logs the failure; the preview does the same, so it never shows an
 * event the page would not push.
 */
class PreviewEventModifiers implements PreviewEventModifiersInterface
{
    /**
     * @param EventModifierPipelineInterface $modifiers
     * @param PreviewOutcomeInterfaceFactory $outcomeFactory
     * @param LoggerInterface $logger
     */
    public function __construct(
        private readonly EventModifierPipelineInterface $modifiers,
        private readonly PreviewOutcomeInterfaceFactory $outcomeFactory,
        private readonly LoggerInterface $logger
    ) {
    }

    /**
     * @inheritDoc
     */
    public function apply(PreviewOutcomeInterface $outcome): PreviewOutcomeInterface
    {
        if ($outcome->getStatus() !== PreviewOutcomeInterface::SENT) {
            return $outcome;
        }
        $event = $outcome->getEvent();
        try {
            $modified = $this->modifiers->apply($event);
        } catch (\Throwable $exception) {
            $this->logger->error('A GA4 event modifier failed on the setup preview\'s event.', [
                'event' => $event->getName(),
                'exception' => $exception,
            ]);

            return $this->outcomeFactory->create([
                'status' => PreviewOutcomeInterface::NOT_SENT,
                'reason' => __('An event modifier failed on this event, so the page leaves it out; see the log.'),
            ]);
        }
        if ($modified === null) {
            return $this->outcomeFactory->create([
                'status' => PreviewOutcomeInterface::NOT_SENT,
                'reason' => __('An event modifier drops this event, so the page sends nothing.'),
            ]);
        }

        return $this->outcomeFactory->create(['status' => PreviewOutcomeInterface::SENT, 'event' => $modified]);
    }
}
