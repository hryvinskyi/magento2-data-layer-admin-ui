<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Test\Unit\Model\LoaderStatus;

use Hryvinskyi\DataLayerAdminUi\Model\LoaderStatus\LoaderState;
use Hryvinskyi\DataLayerAdminUi\Model\LoaderStatus\LoaderStatusResolver;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/**
 * A scope outputs the loader when the data layer is on and the container id is one, from its host or Google's
 */
class LoaderStatusResolverTest extends TestCase
{
    /**
     * Each combination of settings gives its state and, when output, the script's address
     *
     * @dataProvider settings
     * @param mixed $enabled
     * @param mixed $containerId
     * @param mixed $host
     * @param LoaderState $state
     * @param string $url
     * @return void
     */
    #[DataProvider('settings')]
    public function testState(mixed $enabled, mixed $containerId, mixed $host, LoaderState $state, string $url): void
    {
        self::assertSame(
            ['state' => $state, 'url' => $url],
            (new LoaderStatusResolver())->resolve($enabled, $containerId, $host)
        );
    }

    /**
     * Settings and the status they give
     *
     * @return array<string, array{mixed, mixed, mixed, LoaderState, string}>
     */
    public static function settings(): array
    {
        return [
            'off' => ['0', 'GTM-AB12', '', LoaderState::Disabled, ''],
            'off, never saved' => [null, 'GTM-AB12', '', LoaderState::Disabled, ''],
            'no container' => ['1', ' ', '', LoaderState::NoContainer, ''],
            'container that is not one' => ['1', 'GTM 1234', '', LoaderState::InvalidContainer, ''],
            'default host' => ['1', 'GTM-AB12', '', LoaderState::Output,
                'https://www.googletagmanager.com/gtm.js?id=GTM-AB12'],
            'own host' => ['1', ' GTM-AB12 ', 'gtm.example.com', LoaderState::Output,
                'https://gtm.example.com/gtm.js?id=GTM-AB12'],
        ];
    }
}
