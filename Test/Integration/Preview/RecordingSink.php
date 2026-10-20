<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Test\Integration\Preview;

use Hryvinskyi\DataLayerApi\Api\Data\EventInterface;
use Hryvinskyi\DataLayerApi\Api\Data\VisitorContextInterface;
use Hryvinskyi\DataLayerApi\Api\ServerEventSinkInterface;

/**
 * A server event sink that only remembers the names of the events it is handed
 */
class RecordingSink implements ServerEventSinkInterface
{
    /**
     * @var list<string>
     */
    private array $names = [];

    /**
     * @inheritDoc
     */
    public function accept(
        EventInterface $event,
        int $storeId,
        ?VisitorContextInterface $visitor,
        ?string $deduplicationKey = null
    ): void {
        $this->names[] = $event->getName();
    }

    /**
     * Get the names of the events handed over so far
     *
     * @return list<string>
     */
    public function names(): array
    {
        return $this->names;
    }

    /**
     * Forget every event handed over so far
     *
     * @return void
     */
    public function forget(): void
    {
        $this->names = [];
    }
}
