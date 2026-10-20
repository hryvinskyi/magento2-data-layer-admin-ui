<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Model\Setup\Http;

use Hryvinskyi\DataLayerAdminUi\Api\Setup\Http\JsonBodyInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\InvalidSetupRequestException;
use Magento\Framework\App\PlainTextRequestInterface;
use Magento\Framework\App\RequestInterface;
use Magento\Framework\Serialize\SerializerInterface;

/**
 * Decodes the request body with the framework's JSON serializer and accepts only an object
 *
 * An empty body, malformed JSON, or JSON that is not an object (a list, text, a number) is refused with one message;
 * the serializer's own message, which names its internals, never reaches the person.
 */
class JsonBody implements JsonBodyInterface
{
    /**
     * @param SerializerInterface $serializer The JSON serializer
     */
    public function __construct(
        private readonly SerializerInterface $serializer
    ) {
    }

    /**
     * @inheritDoc
     */
    public function read(RequestInterface $request): array
    {
        $decoded = $this->decode($request);
        if (!is_array($decoded) || ($decoded !== [] && array_is_list($decoded))) {
            throw new InvalidSetupRequestException(__('The request must carry a JSON object.'));
        }

        return $decoded;
    }

    /**
     * Decode the body, if there is one to decode
     *
     * @param RequestInterface $request
     * @return mixed What the body decodes to; null when the request has no body or it is not JSON
     */
    private function decode(RequestInterface $request): mixed
    {
        $content = $request instanceof PlainTextRequestInterface ? $request->getContent() : null;
        if (!is_string($content) || trim($content) === '') {
            return null;
        }
        try {
            return $this->serializer->unserialize($content);
        } catch (\InvalidArgumentException) {
            return null;
        }
    }
}
