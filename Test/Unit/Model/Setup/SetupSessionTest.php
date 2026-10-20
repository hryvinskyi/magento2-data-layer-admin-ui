<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Test\Unit\Model\Setup;

use Hryvinskyi\DataLayerAdminUi\Api\Setup\ScopeTreeInterface;
use Hryvinskyi\DataLayerAdminUi\Model\Setup\SetupSession;
use Hryvinskyi\DataLayerAdminUi\Model\Setup\SetupUrls;
use Magento\Backend\Model\UrlInterface;
use Magento\Framework\Data\Form\FormKey;
use PHPUnit\Framework\TestCase;

/**
 * The session answer carries the session's form key, the request endpoints the page configuration carries (the
 * session's own without a secret key) and the Advanced settings and Close links of every scope of the scope tree
 */
class SetupSessionTest extends TestCase
{
    /**
     * Every address is built by the same URL builder the page configuration uses
     *
     * @return void
     */
    public function testDescribesTheSessionsKeyAndAddresses(): void
    {
        $urlBuilder = $this->createMock(UrlInterface::class);
        $urlBuilder->method('getUrl')->willReturnCallback(
            static function (?string $route = null, ?array $params = null): string {
                $query = $params === null || $params === [] ? '' : '?' . http_build_query($params);

                return 'https://admin.test/' . $route . $query;
            }
        );
        $formKey = $this->createMock(FormKey::class);
        $formKey->method('getFormKey')->willReturn('renewed-key');
        $scopeTree = $this->createMock(ScopeTreeInterface::class);
        $scopeTree->method('getScopes')->willReturn([
            ['id' => 'default', 'type' => 'default', 'name' => 'Default', 'code' => '', 'parent' => null],
            ['id' => 'website:1', 'type' => 'website', 'name' => 'Main', 'code' => 'base', 'parent' => 'default'],
        ]);
        $config = 'https://admin.test/adminhtml/system_config/edit?section=hryvinskyi_datalayer';
        $links = ['default' => $config, 'website:1' => $config . '&website=1'];

        $session = (new SetupSession(new SetupUrls($urlBuilder, new ScopeIdFactoryStub()), $scopeTree, $formKey))
            ->describe();

        self::assertSame([
            'formKey' => 'renewed-key',
            'endpoints' => [
                'save' => 'https://admin.test/hryvinskyi_datalayer/setup/save',
                'preview' => 'https://admin.test/hryvinskyi_datalayer/setup/preview',
                'products' => 'https://admin.test/hryvinskyi_datalayer/setup/products',
                'session' => 'https://admin.test/hryvinskyi_datalayer/setup/session?_nosecret=1',
            ],
            'links' => ['advanced' => $links, 'close' => $links],
        ], $session);
    }
}
