<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Test\Integration;

use Magento\Backend\Model\Auth;
use Magento\TestFramework\Bootstrap as TestBootstrap;
use Magento\TestFramework\Helper\Bootstrap;

/**
 * Signs the test framework's administrator in for a test that calls the wizard's use cases directly, as the admin's
 * controllers do for a signed-in user: what a setting shows and saves depends on the user's access rules
 */
trait SignsInAdministrator
{
    /**
     * Sign the administrator in
     *
     * @return void
     */
    private function signIn(): void
    {
        $auth = Bootstrap::getObjectManager()->get(Auth::class);
        self::assertInstanceOf(Auth::class, $auth);
        $auth->login(TestBootstrap::ADMIN_NAME, TestBootstrap::ADMIN_PASSWORD);
    }

    /**
     * Sign the administrator out again
     *
     * @return void
     */
    private function signOut(): void
    {
        $auth = Bootstrap::getObjectManager()->get(Auth::class);
        self::assertInstanceOf(Auth::class, $auth);
        $auth->logout();
    }
}
