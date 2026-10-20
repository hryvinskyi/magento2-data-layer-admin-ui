<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Model;

use Hryvinskyi\DataLayerAdminUi\Api\ModuleScriptInterface;
use Hryvinskyi\DataLayer\Api\Browser\ImportMapBuilderInterface;
use Hryvinskyi\ThemeAssets\Api\AssetRendererInterface;
use Magento\Framework\View\Helper\SecureHtmlRenderer;

/**
 * Prints the import map as an inline script through the secure renderer (so the content security policy admits it),
 * then the entry through the asset renderer as an external ES module; the map is the core's, the one the storefront
 * prints too, so its addresses come from the asset repository (minified files when the store minifies scripts) and
 * `<` and `>` are escaped
 */
class ModuleScript implements ModuleScriptInterface
{
    /**
     * @param ImportMapBuilderInterface $importMapBuilder
     * @param AssetRendererInterface $assetRenderer
     * @param SecureHtmlRenderer $secureRenderer
     */
    public function __construct(
        private readonly ImportMapBuilderInterface $importMapBuilder,
        private readonly AssetRendererInterface $assetRenderer,
        private readonly SecureHtmlRenderer $secureRenderer
    ) {
    }

    /**
     * @inheritDoc
     */
    public function render(string $entryFileId, array $imports): string
    {
        return $this->secureRenderer->renderTag(
            'script',
            ['type' => 'importmap'],
            $this->importMapBuilder->json($this->importMapBuilder->addresses($imports)),
            false
        ) . $this->assetRenderer->renderScript(
            $entryFileId,
            AssetRendererInterface::RENDER_EXTERNAL,
            AssetRendererInterface::LOAD_SYNC,
            AssetRendererInterface::PRELOAD_DISABLED,
            [],
            ['attributes' => ['type' => 'module']]
        );
    }
}
