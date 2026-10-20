<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Test\Unit\Model\Setup;

use Hryvinskyi\DataLayerAdminUi\Model\Setup\StoreViewEmulation;
use Magento\Store\Model\App\Emulation;
use PHPUnit\Framework\TestCase;

/**
 * The work runs inside a forced storefront emulation of the store view, which is stopped whether the work returns or
 * throws
 */
class StoreViewEmulationTest extends TestCase
{
    /**
     * The emulation starts as the store view's storefront before the work and stops after it
     *
     * @return void
     */
    public function testWorkRunsInsideTheEmulation(): void
    {
        $calls = [];
        $emulation = $this->recordingEmulation($calls);

        $built = new \stdClass();

        $result = (new StoreViewEmulation($emulation))->run(3, static function () use (&$calls, $built): \stdClass {
            $calls[] = 'work';

            return $built;
        });

        self::assertSame($built, $result);
        self::assertSame(['start 3 frontend forced', 'work', 'stop'], $calls);
    }

    /**
     * Work that throws still stops the emulation, and its exception reaches the caller
     *
     * @return void
     */
    public function testEmulationStopsWhenTheWorkThrows(): void
    {
        $calls = [];
        $emulation = $this->recordingEmulation($calls);

        $failure = null;
        try {
            (new StoreViewEmulation($emulation))->run(2, $this->failingWork(...));
        } catch (\RuntimeException $exception) {
            $failure = $exception->getMessage();
        }

        self::assertSame('builder failed', $failure);
        self::assertSame(['start 2 frontend forced', 'stop'], $calls);
    }

    /**
     * Work that fails
     *
     * @return string
     * @throws \RuntimeException Always
     */
    private function failingWork(): string
    {
        throw new \RuntimeException('builder failed');
    }

    /**
     * An emulation that records when it starts and stops
     *
     * @param list<string> $calls
     * @return Emulation
     */
    private function recordingEmulation(array &$calls): Emulation
    {
        $emulation = $this->createMock(Emulation::class);
        $emulation->method('startEnvironmentEmulation')->willReturnCallback(
            static function (mixed $storeId, mixed $area, mixed $force) use (&$calls): void {
                $calls[] = sprintf(
                    'start %s %s %s',
                    is_scalar($storeId) ? (string) $storeId : '?',
                    is_scalar($area) ? (string) $area : '?',
                    $force === true ? 'forced' : 'unforced'
                );
            }
        );
        $emulation->method('stopEnvironmentEmulation')->willReturnCallback(
            static function () use (&$calls, $emulation): Emulation {
                $calls[] = 'stop';

                return $emulation;
            }
        );

        return $emulation;
    }
}
