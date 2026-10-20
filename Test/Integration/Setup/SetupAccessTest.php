<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Test\Integration\Setup;

use Hryvinskyi\DataLayer\Test\Integration\ResolvesServices;
use Magento\Framework\Acl\Builder as AclBuilder;
use Magento\Framework\App\Request\Http as HttpRequest;
use Magento\Framework\App\Response\Http as HttpResponse;
use Magento\Framework\Data\Form\FormKey;
use Magento\TestFramework\TestCase\AbstractBackendController;
use Magento\User\Model\User;
use PHPUnit\Framework\Attributes\DataProvider;

/**
 * Every page and endpoint of the setup wizard is closed to an administrator whose role does not allow the data
 * layer's settings: the admin answers 403 and the action never runs, whatever the request carries
 *
 * @magentoAppArea adminhtml
 * @magentoAppIsolation enabled
 * @magentoDbIsolation enabled
 */
class SetupAccessTest extends AbstractBackendController
{
    use ResolvesServices;

    private const RESOURCE = 'Hryvinskyi_DataLayerAdminUi::config';

    /**
     * @var string
     */
    protected $resource = self::RESOURCE;

    /**
     * @var string
     */
    protected $uri = 'backend/hryvinskyi_datalayer/setup/index';

    /**
     * @var string
     */
    protected $httpMethod = HttpRequest::METHOD_GET;

    /**
     * A role without the settings' rule gets 403 from each action, asked the way the browser asks it
     *
     * @dataProvider wizardActions
     * @param string $action
     * @param string $method
     * @param string $body
     * @return void
     */
    #[DataProvider('wizardActions')]
    public function testRoleWithoutTheSettingsRuleIsRefused(string $action, string $method, string $body): void
    {
        $request = $this->getRequest();
        self::assertInstanceOf(HttpRequest::class, $request);
        $request->setMethod($method);
        $request->setQueryValue('isAjax', 'true');
        $request->setQueryValue('form_key', $this->service(FormKey::class)->getFormKey());
        $request->setQueryValue('store', 'store:1');
        $request->setContent($body);
        $user = $this->_auth->getUser();
        self::assertInstanceOf(User::class, $user);
        $this->service(AclBuilder::class)->getAcl()->deny($user->getRoles(), self::RESOURCE);

        $this->dispatch('backend/hryvinskyi_datalayer/setup/' . $action);

        $response = $this->getResponse();
        self::assertInstanceOf(HttpResponse::class, $response);
        self::assertSame(403, $response->getHttpResponseCode());
        self::assertStringNotContainsString('"formKey"', (string) $response->getBody());
        self::assertStringNotContainsString('"results"', (string) $response->getBody());
    }

    /**
     * Each action of the wizard, with the method and body its browser code sends
     *
     * @return array<string, array{string, string, string}>
     */
    public static function wizardActions(): array
    {
        return [
            'page' => ['index', HttpRequest::METHOD_GET, ''],
            'save' => ['save', HttpRequest::METHOD_POST, '{"changes":[]}'],
            'preview' => [
                'preview',
                HttpRequest::METHOD_POST,
                '{"store":"store:1","kind":"view_item","product":null,"priceVisible":true,"settings":{}}',
            ],
            'products' => ['products', HttpRequest::METHOD_GET, ''],
            'session' => ['session', HttpRequest::METHOD_GET, ''],
        ];
    }
}
