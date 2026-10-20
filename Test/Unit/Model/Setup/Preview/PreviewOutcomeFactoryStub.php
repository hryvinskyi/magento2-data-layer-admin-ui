<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Test\Unit\Model\Setup\Preview;

use Hryvinskyi\DataLayerAdminUi\Api\Setup\Data\PreviewOutcomeInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\Data\PreviewOutcomeInterfaceFactory;
use Hryvinskyi\DataLayerAdminUi\Model\Setup\Data\PreviewOutcome;
use Hryvinskyi\DataLayerApi\Api\Data\EventInterface;
use Magento\Framework\Phrase;

/**
 * Builds real preview outcomes from the named arguments the generated factory would pass on
 */
class PreviewOutcomeFactoryStub extends PreviewOutcomeInterfaceFactory
{
    /**
     * Build without an object manager
     */
    public function __construct()
    {
    }

    /**
     * Build an outcome from named arguments
     *
     * @param array<string, mixed> $data
     * @return PreviewOutcomeInterface
     */
    public function create(array $data = [])
    {
        $status = $data['status'] ?? null;
        $event = $data['event'] ?? null;
        $reason = $data['reason'] ?? null;

        return new PreviewOutcome(
            is_string($status) ? $status : '',
            $event instanceof EventInterface ? $event : null,
            $reason instanceof Phrase ? $reason : null
        );
    }
}
