<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Api\Setup\Http;

use Hryvinskyi\DataLayerAdminUi\Api\Setup\InvalidSetupRequestException;
use Magento\Framework\App\RequestInterface;

/**
 * Reads a save request of the setup wizard: a JSON body `{"changes": [...]}`
 *
 * Only the list itself is checked here; each change is checked by the saver, which refuses the whole request when one
 * is malformed.
 *
 * @api
 */
interface SaveRequestReaderInterface
{
    /**
     * Read the changes to save
     *
     * @param RequestInterface $request
     * @return list<mixed> The changes, in the order the browser sent them
     * @throws InvalidSetupRequestException When the body is not an object holding a list of changes; the reason says
     *     so
     */
    public function read(RequestInterface $request): array;
}
