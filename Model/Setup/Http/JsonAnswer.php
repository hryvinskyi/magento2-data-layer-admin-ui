<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Model\Setup\Http;

use Hryvinskyi\DataLayerAdminUi\Api\Setup\Http\JsonAnswerInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\InvalidSetupRequestException;
use Magento\Framework\Controller\Result\Json;
use Magento\Framework\Controller\Result\JsonFactory;
use Psr\Log\LoggerInterface;

/**
 * Builds the endpoint's JSON result from what the work returns, a refusal or a failure
 */
class JsonAnswer implements JsonAnswerInterface
{
    private const BAD_REQUEST = 400;
    private const SERVER_ERROR = 500;

    /**
     * @param JsonFactory $jsonFactory
     * @param LoggerInterface $logger
     */
    public function __construct(
        private readonly JsonFactory $jsonFactory,
        private readonly LoggerInterface $logger
    ) {
    }

    /**
     * @inheritDoc
     */
    public function answer(string $endpoint, callable $work): Json
    {
        $json = $this->jsonFactory->create();
        try {
            $data = $work();
        } catch (InvalidSetupRequestException $refusal) {
            $json->setHttpResponseCode(self::BAD_REQUEST);

            return $json->setData(['error' => $refusal->getReason()->render()]);
        } catch (\Throwable $failure) {
            $this->logger->error(
                'A setup wizard request failed.',
                ['endpoint' => $endpoint, 'exception' => $failure]
            );
            $json->setHttpResponseCode(self::SERVER_ERROR);

            return $json->setData([
                'error' => (string) __('The request could not be completed. Details are in the log.'),
            ]);
        }

        return $json->setData($data);
    }
}
