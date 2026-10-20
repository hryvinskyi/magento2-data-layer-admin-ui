<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Model\Setup\Data;

use Hryvinskyi\DataLayerAdminUi\Api\Setup\Data\PreviewOutcomeInterface;
use Hryvinskyi\DataLayerApi\Api\Data\EventInterface;
use Magento\Framework\Phrase;

/**
 * An event preview's outcome, valid by construction
 *
 * A sent outcome has an event and no reason; a not-sent or unavailable one has a reason and no event. Any other
 * combination, or an unknown status, is refused when the outcome is created.
 */
class PreviewOutcome implements PreviewOutcomeInterface
{
    /**
     * @var 'sent'|'not_sent'|'unavailable'
     */
    private readonly string $status;

    /**
     * @param string $status One of the outcome statuses
     * @param EventInterface|null $event The event, for a sent outcome only
     * @param Phrase|null $reason The reason, for any other outcome
     * @throws \InvalidArgumentException When the status is unknown, or the event or the reason does not fit it
     */
    public function __construct(
        string $status,
        private readonly ?EventInterface $event = null,
        private readonly ?Phrase $reason = null
    ) {
        $this->status = match ($status) {
            self::SENT => self::SENT,
            self::NOT_SENT => self::NOT_SENT,
            self::UNAVAILABLE => self::UNAVAILABLE,
            default => throw new \InvalidArgumentException(
                sprintf('"%s" is not an event preview outcome.', $status)
            ),
        };
        $sent = $this->status === self::SENT;
        if ($sent !== ($event !== null) || $sent === ($reason !== null)) {
            throw new \InvalidArgumentException(
                'A sent preview carries an event and no reason; any other carries a reason and no event.'
            );
        }
    }

    /**
     * @inheritDoc
     */
    public function getStatus(): string
    {
        return $this->status;
    }

    /**
     * @inheritDoc
     */
    public function getEvent(): EventInterface
    {
        return $this->event ?? throw new \LogicException('Only a sent preview carries an event.');
    }

    /**
     * @inheritDoc
     */
    public function getReason(): Phrase
    {
        return $this->reason ?? throw new \LogicException('A sent preview carries no reason.');
    }
}
