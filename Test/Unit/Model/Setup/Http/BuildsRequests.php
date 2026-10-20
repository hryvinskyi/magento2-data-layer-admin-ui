<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Test\Unit\Model\Setup\Http;

use Magento\Framework\App\RequestContentInterface;

/**
 * Builds requests with a body and parameters, as the admin hands one to a controller
 */
trait BuildsRequests
{
    /**
     * Build a request
     *
     * @param string $content The body
     * @param array<string, mixed> $params Query and route parameters
     * @return RequestContentInterface
     */
    private function request(string $content = '', array $params = []): RequestContentInterface
    {
        $request = $this->createMock(RequestContentInterface::class);
        $request->method('getContent')->willReturn($content);
        $request->method('getParam')->willReturnCallback(
            static fn (string $key, mixed $default = null): mixed => $params[$key] ?? $default
        );

        return $request;
    }
}
