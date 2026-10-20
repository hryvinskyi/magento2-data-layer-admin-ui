<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Test\Integration\Setup;

use Hryvinskyi\DataLayer\Test\Integration\ResolvesServices;
use Hryvinskyi\DataLayerAdminUi\Model\Setup\SettingDescriptors;
use Magento\Framework\Acl\Builder as AclBuilder;
use Magento\Framework\App\Request\Http as HttpRequest;
use Magento\Framework\App\Response\Http as HttpResponse;
use Magento\Framework\Data\Form\FormKey;
use Magento\TestFramework\Helper\Bootstrap;
use Magento\TestFramework\ObjectManager;
use Magento\TestFramework\TestCase\AbstractBackendController;
use Magento\User\Model\User;

/**
 * A setting another module adds to the wizard from another section of the configuration page is shown and saved only
 * for an administrator that section's access rule allows: for one it does not, the state leaves the setting out and a
 * save that changes it is refused whole, as one naming an unknown setting is
 *
 * The wizard is given two settings: its own `enabled` and `store_name`, the store information's name, which sits in
 * the configuration page's general section.
 *
 * @magentoAppArea adminhtml
 * @magentoAppIsolation enabled
 * @magentoDbIsolation enabled
 */
class SectionAccessTest extends AbstractBackendController
{
    use ResolvesServices;

    private const GENERAL_SECTION_RULE = 'Magento_Config::config_general';

    /**
     * @var string
     */
    protected $resource = 'Hryvinskyi_DataLayerAdminUi::config';

    /**
     * @var string
     */
    protected $uri = 'backend/hryvinskyi_datalayer/setup/save';

    /**
     * @var string
     */
    protected $httpMethod = HttpRequest::METHOD_POST;

    /**
     * Give the wizard the two settings, and send requests the way its browser code does
     *
     * @inheritDoc
     */
    protected function setUp(): void
    {
        parent::setUp();
        $objectManager = Bootstrap::getObjectManager();
        self::assertInstanceOf(ObjectManager::class, $objectManager);
        $descriptors = $objectManager->create(SettingDescriptors::class, ['descriptors' => [
            'enabled' => ['path' => 'hryvinskyi_datalayer/general/enabled', 'kind' => 'flag', 'step' => 'connect'],
            'store_name' => ['path' => 'general/store_information/name', 'kind' => 'text', 'step' => 'connect'],
        ]]);
        $objectManager->addSharedInstance($descriptors, SettingDescriptors::class);
        $request = $this->request();
        $request->setMethod(HttpRequest::METHOD_POST);
        $request->setQueryValue('isAjax', 'true');
        $request->setQueryValue('form_key', $this->service(FormKey::class)->getFormKey());
    }

    /**
     * An administrator the general section is open to sees and saves the setting
     *
     * @return void
     */
    public function testAllowedSectionsSettingIsShownAndSaved(): void
    {
        $answer = $this->save([['scope' => 'default', 'key' => 'store_name', 'op' => 'set', 'value' => 'Wizard Shop']]);

        self::assertSame(200, $this->response()->getHttpResponseCode());
        self::assertSame([['scope' => 'default', 'key' => 'store_name', 'status' => 'saved']], $answer['results']);
        self::assertSame(['enabled', 'store_name'], $this->settingKeys($answer));
    }

    /**
     * For an administrator the general section is closed to, the state leaves the setting out
     *
     * @return void
     */
    public function testClosedSectionsSettingIsLeftOut(): void
    {
        $this->closeTheGeneralSection();

        self::assertSame(['enabled'], $this->settingKeys($this->save([])));
    }

    /**
     * For an administrator the general section is closed to, a change of the setting refuses the whole request
     *
     * @return void
     */
    public function testChangeOfClosedSectionsSettingIsRefused(): void
    {
        $this->closeTheGeneralSection();

        $refused = $this->save([
            ['scope' => 'default', 'key' => 'enabled', 'op' => 'set', 'value' => true],
            ['scope' => 'default', 'key' => 'store_name', 'op' => 'set', 'value' => 'Wizard Shop'],
        ]);

        self::assertSame(400, $this->response()->getHttpResponseCode());
        self::assertSame(['error' => 'You are not allowed to change the setting "store_name".'], $refused);
    }

    /**
     * Take the general section's rule away from the signed-in administrator's role
     *
     * @return void
     */
    private function closeTheGeneralSection(): void
    {
        $user = $this->_auth->getUser();
        self::assertInstanceOf(User::class, $user);
        $this->service(AclBuilder::class)->getAcl()->deny($user->getRoles(), self::GENERAL_SECTION_RULE);
    }

    /**
     * Post changes to the save endpoint and decode the answer
     *
     * @param list<array<string, mixed>> $changes
     * @return array<mixed>
     */
    private function save(array $changes): array
    {
        $this->request()->setContent((string) json_encode(['changes' => $changes]));
        $this->dispatch('backend/hryvinskyi_datalayer/setup/save');
        $answer = json_decode((string) $this->response()->getBody(), true);
        self::assertIsArray($answer, (string) $this->response()->getBody());

        return $answer;
    }

    /**
     * Read the keys of the settings a save answer's state reports
     *
     * @param array<mixed> $answer
     * @return list<mixed>
     */
    private function settingKeys(array $answer): array
    {
        self::assertIsArray($answer['state'] ?? null, (string) json_encode($answer));
        self::assertIsArray($answer['state']['settings'] ?? null);

        return array_column($answer['state']['settings'], 'key');
    }

    /**
     * Get the request
     *
     * @return HttpRequest
     */
    private function request(): HttpRequest
    {
        $request = $this->getRequest();
        self::assertInstanceOf(HttpRequest::class, $request);

        return $request;
    }

    /**
     * Get the response
     *
     * @return HttpResponse
     */
    private function response(): HttpResponse
    {
        $response = $this->getResponse();
        self::assertInstanceOf(HttpResponse::class, $response);

        return $response;
    }
}
