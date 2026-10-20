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
 * Reads the JSON object a setup wizard request carries as its body
 *
 * The body is JSON, so the admin's form key never travels in it: the browser sends that in the query string.
 *
 * @api
 */
interface JsonBodyInterface
{
    /**
     * Decode the request body
     *
     * @param RequestInterface $request
     * @return array<mixed> The object's fields, keyed by name
     * @throws InvalidSetupRequestException When the body is not a JSON object; the reason says so
     */
    public function read(RequestInterface $request): array;
}
