<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Block\Adminhtml\System\Config;

use Hryvinskyi\DataLayerAdminUi\Api\EventsTable\EventsTableBuilderInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Form\SettingsGroupLinkInterface;
use Hryvinskyi\DataLayerAdminUi\Api\ModuleScriptInterface;
use Hryvinskyi\DataLayerAdminUi\Api\ServerDeliveryStateInterface;
use Magento\Backend\Block\Template\Context;
use Magento\Config\Block\System\Config\Form\Field;
use Magento\Framework\Data\Form\Element\AbstractElement;
use Magento\Framework\Data\OptionSourceInterface;
use Magento\Framework\Serialize\Serializer\JsonHexTag;
use Magento\Framework\View\Helper\SecureHtmlRenderer;
use Magento\Store\Model\ScopeInterface;

/**
 * Renders the disabled-events setting as the table of every known event, with a Send switch and a channel each
 *
 * The table owns two settings: the events switched off (this field) and the routing rows (a hidden sibling field of
 * the same group). It posts both, under each field's own name, so each is saved through its own backend model; one
 * "use the parent scope's value" checkbox covers both, and is ticked only while neither has a value of its own here.
 * What the browser posts starts as the stored values and changes only when the table does.
 *
 * @phpstan-import-type Table from EventsTableBuilderInterface
 */
class EventsTable extends Field
{
    private const ROUTING_FIELD = 'routing';
    private const ENTRY_FILE_ID = 'Hryvinskyi_DataLayerAdminUi::js/events-table/main.js';
    private const IMPORTS = [
        '@hryvinskyi/data-layer-admin/events-table/widget.js'
            => 'Hryvinskyi_DataLayerAdminUi::js/events-table/widget.js',
        '@hryvinskyi/data-layer-admin/events-table/table-state.js'
            => 'Hryvinskyi_DataLayerAdminUi::js/events-table/table-state.js',
    ];

    /**
     * @var string
     */
    protected $_template = 'Hryvinskyi_DataLayerAdminUi::system/config/events-table.phtml';

    /**
     * @param Context $context
     * @param EventsTableBuilderInterface $tableBuilder
     * @param ServerDeliveryStateInterface $serverDelivery
     * @param OptionSourceInterface $channels The channels an event can be routed to, with their labels
     * @param ModuleScriptInterface $moduleScript
     * @param SettingsGroupLinkInterface $settingsLink
     * @param JsonHexTag $json
     * @param SecureHtmlRenderer $secureRenderer
     * @param array<string,mixed> $data
     */
    public function __construct(
        Context $context,
        private readonly EventsTableBuilderInterface $tableBuilder,
        private readonly ServerDeliveryStateInterface $serverDelivery,
        private readonly OptionSourceInterface $channels,
        private readonly ModuleScriptInterface $moduleScript,
        private readonly SettingsGroupLinkInterface $settingsLink,
        private readonly JsonHexTag $json,
        SecureHtmlRenderer $secureRenderer,
        array $data = []
    ) {
        parent::__construct($context, $data, $secureRenderer);
    }

    /**
     * Render the table as one full-width row of the settings form
     *
     * @param AbstractElement $element
     * @return string
     */
    public function render(AbstractElement $element)
    {
        $this->assign('view', $this->view($element));

        return '<tr id="row_' . $this->_escaper->escapeHtmlAttr($this->text($element->getHtmlId())) . '">'
            . '<td colspan="4">' . $this->toHtml() . '</td></tr>';
    }

    /**
     * Build what the template prints
     *
     * @param AbstractElement $element
     * @return array<string, mixed>
     */
    private function view(AbstractElement $element): array
    {
        $routing = $this->routingElement($element);
        $table = $this->tableBuilder->build($element->getData('value'), $routing?->getData('value'));
        $websiteId = $this->websiteId($element);
        $inheritShown = (bool) $element->getData('can_use_website_value')
            || (bool) $element->getData('can_use_default_value');
        $inherited = $inheritShown && (bool) $element->getData('inherit')
            && ($routing === null || (bool) $routing->getData('inherit'));
        $readonly = (bool) $element->getData('is_disable_inheritance');
        $disabledName = $this->text($element->getName());
        $routingName = $routing !== null ? $this->text($routing->getName()) : '';
        $names = [
            'disabled' => $disabledName,
            'disabledInherit' => $this->inheritName($disabledName),
            'routing' => $routingName,
            'routingInherit' => $routingName !== '' ? $this->inheritName($routingName) : '',
        ];
        $channelLabels = $this->channelLabels();
        $serverEnabled = $this->serverDelivery->isEnabled($websiteId);

        return [
            'id' => $this->text($element->getHtmlId()),
            'label' => $this->text($element->getData('label')),
            'scopeLabel' => $this->text($element->getData('scope_label')),
            'comment' => $this->text($element->getData('comment')),
            'inheritShown' => $inheritShown,
            'inherited' => $inherited,
            'inheritLabel' => (string) ($element->getData('can_use_website_value')
                ? __('Use Website')
                : __('Use Default')),
            'readonly' => $readonly,
            'names' => $names,
            'groups' => $table['groups'],
            'channels' => $channelLabels,
            'stored' => $table['stored'],
            'serverSettingsUrl' => $this->serverSettingsUrl($websiteId),
            'config' => $this->json->serialize([
                'rows' => $this->flatRows($table),
                'kept' => $table['kept'],
                'serverDeliveryEnabled' => $serverEnabled,
                'names' => $names,
                'wording' => [
                    'yes' => (string) __('Yes'),
                    'no' => (string) __('No'),
                    'counter' => (string) __('%1 of %2 sent · %3 from the server', '{sent}', '{total}', '{server}'),
                ],
            ]),
            'script' => $this->moduleScript->render(self::ENTRY_FILE_ID, self::IMPORTS),
        ];
    }

    /**
     * Find the routing field of the same group, which this table also saves
     *
     * @param AbstractElement $element
     * @return AbstractElement|null Null when the form has no such field
     */
    private function routingElement(AbstractElement $element): ?AbstractElement
    {
        $config = $element->getData('field_config');
        $fieldId = is_array($config) && is_string($config['id'] ?? null) ? $config['id'] : '';
        $htmlId = $this->text($element->getId());
        if ($fieldId === '' || !str_ends_with($htmlId, $fieldId)) {
            return null;
        }
        $routing = $element->getForm()->getElement(substr($htmlId, 0, -strlen($fieldId)) . self::ROUTING_FIELD);

        return $routing instanceof AbstractElement ? $routing : null;
    }

    /**
     * Get the website of the scope the form edits
     *
     * @param AbstractElement $element
     * @return int|null Null at the default scope
     */
    private function websiteId(AbstractElement $element): ?int
    {
        $scope = $element->getData('scope');
        $scopeId = $element->getData('scope_id');
        $scopeId = is_numeric($scopeId) ? (int) $scopeId : 0;

        return match ($scope) {
            ScopeInterface::SCOPE_STORES => (int) $this->_storeManager->getStore($scopeId)->getWebsiteId(),
            ScopeInterface::SCOPE_WEBSITES => $scopeId,
            default => null,
        };
    }

    /**
     * Get the address of the settings group where server-side delivery is switched on, at the same website
     *
     * @param int|null $websiteId
     * @return string Empty when no module delivers server events
     */
    private function serverSettingsUrl(?int $websiteId): string
    {
        $group = $this->serverDelivery->getSettingsGroupPath();
        if ($group === null) {
            return '';
        }

        return $this->getUrl(SettingsGroupLinkInterface::ROUTE, $this->settingsLink->routeParams($group, $websiteId));
    }

    /**
     * Get the label of each channel, keyed by channel code
     *
     * @return array<string, string>
     */
    private function channelLabels(): array
    {
        $labels = [];
        foreach ($this->channels->toOptionArray() as $option) {
            $value = is_array($option) ? $option['value'] ?? null : null;
            $label = is_array($option) ? $option['label'] ?? null : null;
            if (is_string($value) && (is_string($label) || $label instanceof \Stringable)) {
                $labels[$value] = (string) $label;
            }
        }

        return $labels;
    }

    /**
     * Get the rows the browser keeps the table's state in
     *
     * @param Table $table
     * @return list<array{event: string, send: bool, channel: string, fixed: bool}>
     */
    private function flatRows(array $table): array
    {
        $rows = [];
        foreach ($table['groups'] as $group) {
            foreach ($group['rows'] as $row) {
                $rows[] = [
                    'event' => $row['event'],
                    'send' => $row['send'],
                    'channel' => $row['channel'],
                    'fixed' => $row['fixed'],
                ];
            }
        }

        return $rows;
    }

    /**
     * Read a value of the form as text
     *
     * @param mixed $value
     * @return string Empty for anything that is not text or a number
     */
    private function text(mixed $value): string
    {
        return is_scalar($value) || $value instanceof \Stringable ? (string) $value : '';
    }

    /**
     * Get the name of a field's "use the parent scope's value" input, the way the settings form names it
     *
     * @param string $valueName
     * @return string
     */
    private function inheritName(string $valueName): string
    {
        return (string) preg_replace('#\[value\](\[\])?$#', '', $valueName) . '[inherit]';
    }
}
