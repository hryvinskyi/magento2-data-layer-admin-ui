<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Block\Adminhtml\System\Config;

use Hryvinskyi\DataLayerAdminUi\Model\Form\SectionValues;
use Magento\Backend\Block\Template\Context;
use Magento\Framework\Data\Form\Element\AbstractElement;
use Magento\Framework\View\Helper\SecureHtmlRenderer;

/**
 * Warns that GA4 may count every event twice: the scope loads both a Tag Manager container and gtag.js
 *
 * A container with a GA4 tag for the same web stream reports each event the data layer receives, and so does gtag.js
 * with the measurement id. The warning shows while the scope's settings, as the form shows them, set both ids.
 */
class DoubleCountWarning extends NoticeRow
{
    /**
     * @param Context $context
     * @param SectionValues $sectionValues
     * @param SecureHtmlRenderer $secureRenderer
     * @param array<string,mixed> $data
     */
    public function __construct(
        Context $context,
        private readonly SectionValues $sectionValues,
        SecureHtmlRenderer $secureRenderer,
        array $data = []
    ) {
        parent::__construct($context, $data, $secureRenderer);
    }

    /**
     * @inheritDoc
     */
    protected function isShown(AbstractElement $element): bool
    {
        return $this->isSet($this->sectionValues->value($element, 'gtm/container_id'))
            && $this->isSet($this->sectionValues->value($element, 'gtag/measurement_id'));
    }

    /**
     * Whether a setting holds a value
     *
     * @param mixed $value
     * @return bool
     */
    private function isSet(mixed $value): bool
    {
        return is_scalar($value) && trim((string) $value) !== '';
    }
}
