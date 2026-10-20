<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Test\Unit\Model\Config\Backend;

use Hryvinskyi\DataLayer\Api\ConfigInterface;
use Hryvinskyi\DataLayerAdminUi\Model\Config\Backend\ScriptHost;
use Magento\Framework\App\Cache\TypeListInterface;
use Magento\Framework\App\Config\ScopeConfigInterface;
use Magento\Framework\Event\ManagerInterface;
use Magento\Framework\Exception\LocalizedException;
use Magento\Framework\Model\Context;
use Magento\Framework\Registry;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/**
 * The script host pattern the browser checks with accepts exactly the hosts the script host's save accepts
 */
class ScriptHostPatternTest extends TestCase
{
    /**
     * The pattern and the save agree on a host, and both give the expected answer
     *
     * @param string $host
     * @param bool $valid
     * @return void
     */
    #[DataProvider('hosts')]
    public function testPatternAgreesWithTheSave(string $host, bool $valid): void
    {
        self::assertSame($valid, preg_match(ConfigInterface::SCRIPT_HOST_PATTERN, $host) === 1, 'pattern');
        self::assertSame($valid, $this->saves($host), 'save');
    }

    /**
     * Hosts and whether each is a usable script host
     *
     * @return array<string, array{string, bool}>
     */
    public static function hosts(): array
    {
        return [
            'two labels' => ['example.com', true],
            'subdomain' => ['gtm.shop.example.com', true],
            'capitals' => ['GTM.Example.COM', true],
            'digits and inner hyphens' => ['s-1.tag-server2.example.com', true],
            'all digits' => ['1.2', true],
            'trailing dot' => ['example.com.', true],
            'single label with trailing dot' => ['localhost.', true],
            'punycode' => ['xn--bcher-kva.example', true],
            'label of 63' => [str_repeat('a', 63) . '.com', true],
            'host of 253' => [self::longHost(253), true],
            'host of 253 and a final dot' => [self::longHost(253) . '.', true],
            'single label' => ['localhost', false],
            'leading hyphen' => ['-gtm.example.com', false],
            'trailing hyphen' => ['gtm-.example.com', false],
            'label of 64' => [str_repeat('a', 64) . '.com', false],
            'host of 254' => [self::longHost(254), false],
            'empty label' => ['gtm..example.com', false],
            'leading dot' => ['.example.com', false],
            'scheme' => ['https://gtm.example.com', false],
            'path' => ['gtm.example.com/gtm.js', false],
            'port' => ['gtm.example.com:8443', false],
            'underscore' => ['gtm_tag.example.com', false],
            'unicode' => ['bücher.example', false],
            'space' => ['gtm example.com', false],
        ];
    }

    /**
     * Build a host name of four labels, three of 63 characters and a last one making up the length
     *
     * @param int $length Between 193 and 255
     * @return string
     */
    private static function longHost(int $length): string
    {
        $label = str_repeat('a', 63);

        return implode('.', [$label, $label, $label, str_repeat('a', $length - 192)]);
    }

    /**
     * Whether the script host's save accepts a host
     *
     * @param string $host
     * @return bool
     */
    private function saves(string $host): bool
    {
        $context = $this->createMock(Context::class);
        $context->method('getEventDispatcher')->willReturn($this->createMock(ManagerInterface::class));
        $model = new ScriptHost(
            $context,
            $this->createMock(Registry::class),
            $this->createMock(ScopeConfigInterface::class),
            $this->createMock(TypeListInterface::class)
        );
        $model->setValue($host);
        try {
            $model->beforeSave();
        } catch (LocalizedException) {
            return false;
        }

        return true;
    }
}
