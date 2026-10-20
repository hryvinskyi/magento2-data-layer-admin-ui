<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Model\Setup\Http;

use Hryvinskyi\DataLayerAdminUi\Api\Setup\Http\JsonBodyInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\Http\PreviewRequestReaderInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\Http\StoreViewParameterInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\InvalidSetupRequestException;
use Magento\Framework\App\RequestInterface;

/**
 * Checks each field of the preview body for its type and hands them on unchanged; the product is a positive whole
 * number or null (none chosen yet), and the settings an object, which an empty one decodes to as well
 */
class PreviewRequestReader implements PreviewRequestReaderInterface
{
    /**
     * @param JsonBodyInterface $body
     * @param StoreViewParameterInterface $storeView
     */
    public function __construct(
        private readonly JsonBodyInterface $body,
        private readonly StoreViewParameterInterface $storeView
    ) {
    }

    /**
     * @inheritDoc
     */
    public function read(RequestInterface $request): array
    {
        $fields = $this->body->read($request);
        $kind = $fields['kind'] ?? null;
        $product = $fields['product'] ?? null;
        $priceVisible = $fields['priceVisible'] ?? null;
        $settings = $fields['settings'] ?? null;
        if (!is_string($kind) || trim($kind) === '') {
            throw new InvalidSetupRequestException(__('The preview needs the kind of event to preview.'));
        }
        if ($product !== null && (!is_int($product) || $product < 1)) {
            throw new InvalidSetupRequestException(__('The preview needs a product id, or none.'));
        }
        if (!is_bool($priceVisible)) {
            throw new InvalidSetupRequestException(
                __('The preview needs to know whether the visitor sees prices.')
            );
        }
        if (!is_array($settings) || ($settings !== [] && array_is_list($settings))) {
            throw new InvalidSetupRequestException(__('The preview needs the settings keyed by setting.'));
        }

        return [
            'storeId' => $this->storeView->read($fields['store'] ?? null),
            'kind' => $kind,
            'productId' => $product,
            'priceVisible' => $priceVisible,
            'settings' => $settings,
        ];
    }
}
