<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Test\Unit\Model\Config\Backend;

use Hryvinskyi\DataLayerAdminUi\Model\Config\Backend\ChannelRoutingRows;
use Hryvinskyi\DataLayerAdminUi\Model\Config\Backend\DisabledEvents;
use Magento\Framework\App\Cache\TypeListInterface;
use Magento\Framework\App\Config\ScopeConfigInterface;
use Magento\Framework\Event\ManagerInterface;
use Magento\Framework\Exception\LocalizedException;
use Magento\Framework\Model\Context;
use Magento\Framework\Registry;
use Magento\Framework\Serialize\Serializer\Json;
use PHPUnit\Framework\TestCase;

/**
 * The events table's two settings are stored normalised, and a value no event could match is refused
 */
class EventSettingsTest extends TestCase
{
    /**
     * The disabled events become one comma list of trimmed names, each once, from a comma list or a list
     *
     * @return void
     */
    public function testDisabledEventsAreStoredAsOneCommaList(): void
    {
        self::assertSame('sign_up,login', $this->disabled(' sign_up ,login,,sign_up')->getValue());
        self::assertSame('sign_up,login', $this->disabled(['sign_up', ' login', ''])->getValue());
        self::assertSame('', $this->disabled('')->getValue());
        self::assertSame('', $this->disabled(null)->getValue());
    }

    /**
     * A name that is not an event name is refused
     *
     * @return void
     */
    public function testDisabledEventThatIsNotAnEventNameIsRefused(): void
    {
        $this->expectException(LocalizedException::class);
        $this->expectExceptionMessage('is not an event name');

        $this->disabled('sign_up,Add To Cart');
    }

    /**
     * Routing rows are stored as a JSON list; the placeholder row and blank rows are dropped
     *
     * @return void
     */
    public function testRoutingRowsAreStoredAsAList(): void
    {
        $saved = $this->routing([
            '__empty' => '',
            '_1' => ['event' => ' purchase ', 'channel' => 'server'],
            '_2' => ['event' => '', 'channel' => ''],
            '_3' => ['event' => 'add_to_cart', 'channel' => 'both'],
        ]);

        self::assertSame(
            '[{"event":"purchase","channel":"server"},{"event":"add_to_cart","channel":"both"}]',
            $saved->getValue()
        );
        self::assertSame('[]', $this->routing(['__empty' => ''])->getValue());
    }

    /**
     * A row whose event is not an event name, or whose channel does not exist, is refused
     *
     * @return void
     */
    public function testUnusableRoutingRowIsRefused(): void
    {
        $this->expectException(LocalizedException::class);
        $this->expectExceptionMessage('is not a channel');

        $this->routing(['_1' => ['event' => 'purchase', 'channel' => 'cloud']]);
    }

    /**
     * A row without an event name is refused
     *
     * @return void
     */
    public function testRoutingRowWithoutEventIsRefused(): void
    {
        $this->expectException(LocalizedException::class);
        $this->expectExceptionMessage('is not an event name');

        $this->routing(['_1' => ['event' => '', 'channel' => 'server']]);
    }

    /**
     * A model context whose events go nowhere
     *
     * @return Context
     */
    private function context(): Context
    {
        $context = $this->createMock(Context::class);
        $context->method('getEventDispatcher')->willReturn($this->createMock(ManagerInterface::class));

        return $context;
    }

    /**
     * Save a disabled-events value
     *
     * @param mixed $value
     * @return DisabledEvents
     */
    private function disabled(mixed $value): DisabledEvents
    {
        $model = new DisabledEvents(
            $this->context(),
            $this->createMock(Registry::class),
            $this->createMock(ScopeConfigInterface::class),
            $this->createMock(TypeListInterface::class)
        );
        $model->setValue($value);
        $model->beforeSave();

        return $model;
    }

    /**
     * Save a routing value
     *
     * @param mixed $value
     * @return ChannelRoutingRows
     */
    private function routing(mixed $value): ChannelRoutingRows
    {
        $model = new ChannelRoutingRows(
            $this->context(),
            $this->createMock(Registry::class),
            $this->createMock(ScopeConfigInterface::class),
            $this->createMock(TypeListInterface::class),
            null,
            null,
            [],
            new Json()
        );
        $model->setValue($value);
        $model->beforeSave();

        return $model;
    }
}
