<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Block\Adminhtml\System\Config;

use Hryvinskyi\DataLayerAdminUi\Model\Form\SectionValues;
use Hryvinskyi\DataLayerAdminUi\Model\Form\StatusTone;
use Hryvinskyi\DataLayerAdminUi\Model\LoaderStatus\LoaderState;
use Hryvinskyi\DataLayerAdminUi\Model\LoaderStatus\LoaderStatusResolver;
use Magento\Backend\Block\Template\Context;
use Magento\Framework\Data\Form\Element\AbstractElement;
use Magento\Framework\View\Helper\SecureHtmlRenderer;

/**
 * Shows the Tag Manager script address the scope outputs, or why it outputs none, from the scope's settings
 *
 * The settings are read as the form shows them for the scope, so the line matches the values above it once saved.
 * When the loader is output, a link under the line opens Google's Tag Assistant to preview the container.
 *
 * @phpstan-import-type Status from StatusField
 */
class LoaderStatus extends StatusField
{
    private const TAG_ASSISTANT_URL = 'https://tagassistant.google.com/';

    /**
     * @param Context $context
     * @param SectionValues $sectionValues
     * @param LoaderStatusResolver $loaderStatusResolver
     * @param SecureHtmlRenderer $secureRenderer
     * @param array<string,mixed> $data
     */
    public function __construct(
        Context $context,
        private readonly SectionValues $sectionValues,
        private readonly LoaderStatusResolver $loaderStatusResolver,
        SecureHtmlRenderer $secureRenderer,
        array $data = []
    ) {
        parent::__construct($context, $data, $secureRenderer);
    }

    /**
     * @inheritDoc
     */
    protected function status(AbstractElement $element): array
    {
        $status = $this->loaderStatusResolver->resolve(
            $this->sectionValues->value($element, 'general/enabled'),
            $this->sectionValues->value($element, 'gtm/container_id'),
            $this->sectionValues->value($element, 'gtm/script_host')
        );
        $state = $status['state'];
        $line = [
            'tone' => match ($state) {
                LoaderState::Disabled => StatusTone::Muted,
                LoaderState::NoContainer => StatusTone::Attention,
                LoaderState::InvalidContainer => StatusTone::Error,
                LoaderState::Output => StatusTone::Ok,
            },
            'text' => (string) match ($state) {
                LoaderState::Disabled => __('Not output: the module is disabled at this scope.'),
                LoaderState::NoContainer => __('Not output: Container ID is empty.'),
                LoaderState::InvalidContainer => __('Not output: the saved Container ID is not valid.'),
                LoaderState::Output => __('Loader: %1', $status['url']),
            },
            'code' => true,
        ];
        if ($state === LoaderState::Output) {
            $line['link'] = ['url' => self::TAG_ASSISTANT_URL, 'label' => (string) __('Open GTM Preview ↗')];
        }

        return $line;
    }
}
