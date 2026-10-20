<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Test\Unit\Model;

use Hryvinskyi\DataLayerAdminUi\Model\ModuleScript;
use Hryvinskyi\DataLayer\Model\Browser\ImportMapBuilder;
use Hryvinskyi\ThemeAssets\Api\AssetRendererInterface;
use Magento\Framework\Serialize\Serializer\JsonHexTag;
use Magento\Framework\View\Asset\Repository;
use Magento\Framework\View\Helper\SecureHtmlRenderer;
use PHPUnit\Framework\TestCase;

/**
 * The import map of an admin ES module names each module with the address the asset repository gives its file, goes
 * through the secure renderer unescaped, and comes right before the entry, rendered as an external ES module
 */
class ModuleScriptTest extends TestCase
{
    /**
     * @return void
     */
    public function testImportMapPrecedesTheEntry(): void
    {
        $html = $this->moduleScript()->render('Vendor_Module::js/feature/main.js', [
            '@vendor/feature/a.js' => 'Vendor_Module::js/feature/a.js',
            '@vendor/feature/b.js' => 'Vendor_Module::js/feature/b.js',
        ]);

        self::assertSame(
            '<script type="importmap" raw>{"imports":{'
            . '"@vendor\/feature\/a.js":"https:\/\/static.test\/Vendor_Module\/js\/feature\/a.min.js",'
            . '"@vendor\/feature\/b.js":"https:\/\/static.test\/Vendor_Module\/js\/feature\/b.min.js"}}</script>'
            . '<script src="Vendor_Module::js/feature/main.js" mode="external" type="module"></script>',
            $html
        );
    }

    /**
     * A module without imports prints an empty map object, never a list
     *
     * @return void
     */
    public function testNoImportsPrintAnEmptyObject(): void
    {
        self::assertStringStartsWith(
            '<script type="importmap" raw>{"imports":{}}</script>',
            $this->moduleScript()->render('Vendor_Module::js/main.js', [])
        );
    }

    /**
     * Build the service over the core's import map builder on a repository that publishes minified names, a
     * recording secure renderer and asset renderer
     *
     * @return ModuleScript
     */
    private function moduleScript(): ModuleScript
    {
        $repository = $this->createMock(Repository::class);
        $repository->method('getUrl')->willReturnCallback(
            static fn (string $fileId): string => 'https://static.test/'
                . str_replace(['::', '.js'], ['/', '.min.js'], $fileId)
        );
        $secure = $this->createMock(SecureHtmlRenderer::class);
        $secure->method('renderTag')->willReturnCallback(
            static function (string $tag, array $attributes, ?string $content, bool $textContent): string {
                $type = is_string($attributes['type'] ?? null) ? $attributes['type'] : '';

                return '<' . $tag . ' type="' . $type . '"' . ($textContent ? '' : ' raw') . '>' . $content
                    . '</' . $tag . '>';
            }
        );
        $assets = $this->createMock(AssetRendererInterface::class);
        $assets->method('renderScript')->willReturnCallback(
            static function (string $fileId, string $render, string $load, bool $preload, array $params, array $opts) {
                $attributes = is_array($opts['attributes'] ?? null) ? $opts['attributes'] : [];
                $type = is_string($attributes['type'] ?? null) ? $attributes['type'] : '';

                return sprintf('<script src="%s" mode="%s" type="%s"></script>', $fileId, $render, $type);
            }
        );

        return new ModuleScript(new ImportMapBuilder($repository, new JsonHexTag()), $assets, $secure);
    }
}
