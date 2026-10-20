<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Model\Setup\Http;

use Hryvinskyi\DataLayerAdminUi\Api\Setup\Http\JsonBodyInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\Http\SaveRequestReaderInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\InvalidSetupRequestException;
use Magento\Framework\App\RequestInterface;

/**
 * Takes the `changes` list out of the body; an empty list is a request that changes nothing
 */
class SaveRequestReader implements SaveRequestReaderInterface
{
    private const CHANGES = 'changes';

    /**
     * @param JsonBodyInterface $body
     */
    public function __construct(
        private readonly JsonBodyInterface $body
    ) {
    }

    /**
     * @inheritDoc
     */
    public function read(RequestInterface $request): array
    {
        $changes = $this->body->read($request)[self::CHANGES] ?? null;
        if (!is_array($changes) || !array_is_list($changes)) {
            throw new InvalidSetupRequestException(__('The request must carry the changes as a list.'));
        }

        return $changes;
    }
}
