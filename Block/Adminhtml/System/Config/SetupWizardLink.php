<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Block\Adminhtml\System\Config;

use Magento\Framework\Data\Form\Element\AbstractElement;

/**
 * A settings row with one link button that opens the setup wizard at the scope the settings page shows
 *
 * The page names its scope with a `website` or `store` parameter; the link passes on the one present, so the wizard
 * opens where the person was. It stores nothing.
 */
class SetupWizardLink extends ReadOnlyField
{
    private const WIZARD_ROUTE = 'hryvinskyi_datalayer/setup/index';
    private const SCOPE_PARAMS = ['website', 'store'];

    /**
     * @var string
     */
    protected $_template = 'Hryvinskyi_DataLayerAdminUi::system/config/wizard-link.phtml';

    /**
     * Render the link through the template
     *
     * @param AbstractElement $element
     * @return string
     */
    protected function _getElementHtml(AbstractElement $element)
    {
        $this->assign('view', [
            'id' => (string) $element->getHtmlId(),
            'url' => $this->getUrl(self::WIZARD_ROUTE, $this->scopeParams()),
        ]);

        return $this->toHtml();
    }

    /**
     * Get the scope parameters of the settings page that are set
     *
     * @return array<string, string>
     */
    private function scopeParams(): array
    {
        $params = [];
        foreach (self::SCOPE_PARAMS as $name) {
            $value = $this->getRequest()->getParam($name);
            if (is_string($value) && preg_match('/^[1-9][0-9]{0,9}$/D', $value) === 1) {
                $params[$name] = $value;
            }
        }

        return $params;
    }
}
