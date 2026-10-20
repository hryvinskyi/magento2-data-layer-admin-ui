<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Test\Integration;

use Hryvinskyi\DataLayerAdminUi\Api\ModuleScriptInterface;
use Hryvinskyi\DataLayerAdminUi\Model\ModuleScript;
use Magento\Framework\App\State;
use Magento\Framework\View\Asset\Minification;
use Magento\TestFramework\Helper\Bootstrap;
use Magento\TestFramework\ObjectManager;
use PHPUnit\Framework\TestCase;

/**
 * An admin ES module resolves through the real container, and with script minification on its import map and its
 * entry point at the minified files
 *
 * Minification never applies in developer mode, which the test application runs in, so the asset system is given a
 * minification service that sees production mode.
 *
 * @magentoAppArea adminhtml
 * @magentoAppIsolation enabled
 */
class ModuleScriptTest extends TestCase
{
    private const DIRECTORY = 'Hryvinskyi_DataLayerAdminUi::js/events-table/';

    /**
     * @inheritDoc
     */
    protected function tearDown(): void
    {
        $objectManager = Bootstrap::getObjectManager();
        if ($objectManager instanceof ObjectManager) {
            $objectManager->removeSharedInstance(Minification::class);
        }
    }

    /**
     * The import map comes first and names the minified files; the entry is the minified file, as an ES module
     *
     * @magentoConfigFixture default/dev/js/minify_files 1
     * @return void
     */
    public function testImportMapAndEntryUseMinifiedFiles(): void
    {
        $objectManager = Bootstrap::getObjectManager();
        self::assertInstanceOf(ObjectManager::class, $objectManager);
        $state = $objectManager->create(State::class, ['mode' => State::MODE_PRODUCTION]);
        $objectManager->addSharedInstance(
            $objectManager->create(Minification::class, ['appState' => $state]),
            Minification::class
        );
        self::assertInstanceOf(ModuleScript::class, $objectManager->get(ModuleScriptInterface::class));
        $moduleScript = $objectManager->create(ModuleScriptInterface::class);
        self::assertInstanceOf(ModuleScriptInterface::class, $moduleScript);

        $html = $moduleScript->render(
            self::DIRECTORY . 'main.js',
            ['@hryvinskyi/data-layer-admin/events-table/widget.js' => self::DIRECTORY . 'widget.js']
        );

        $pattern = '~^<script type="importmap"[^>]*>(.*?)</script>\s*<script type="module" src="([^"]+)"~s';
        self::assertSame(1, preg_match($pattern, $html, $match), $html);
        $map = json_decode($match[1], true, 512, JSON_THROW_ON_ERROR);
        self::assertIsArray($map);
        self::assertIsArray($map['imports']);
        $widget = $map['imports']['@hryvinskyi/data-layer-admin/events-table/widget.js'] ?? null;
        self::assertIsString($widget);
        self::assertStringEndsWith('/Hryvinskyi_DataLayerAdminUi/js/events-table/widget.min.js', $widget);
        self::assertStringEndsWith('/Hryvinskyi_DataLayerAdminUi/js/events-table/main.min.js', $match[2]);
    }
}
