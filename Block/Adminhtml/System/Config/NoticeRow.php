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
 * A full-width warning across the settings form: the field's comment beside a warning sign
 *
 * It stores nothing. A subclass can show it only when the settings call for it. The notice draws its own box rather
 * than borrowing the admin's message styles, so it reads the same in every settings row it is placed in.
 */
class NoticeRow extends ReadOnlyField
{
    /**
     * Render the notice as one row of the form, or nothing when it does not apply
     *
     * @param AbstractElement $element
     * @return string
     */
    public function render(AbstractElement $element)
    {
        if (!$this->isShown($element)) {
            return '';
        }

        $id = $this->_escaper->escapeHtmlAttr($element->getHtmlId());

        return '<tr id="row_' . $id . '"><td colspan="4">'
            . '<div id="' . $id . '" class="hryvinskyi-datalayer-notice" role="note">'
            . '<span class="hryvinskyi-datalayer-notice__icon" aria-hidden="true">!</span>'
            . '<span class="hryvinskyi-datalayer-notice__text">'
            . $this->_escaper->escapeHtml($this->comment($element)) . '</span>'
            . '</div></td></tr>';
    }

    /**
     * Get the field's comment as text
     *
     * @param AbstractElement $element
     * @return string
     */
    private function comment(AbstractElement $element): string
    {
        $comment = $element->getData('comment');

        return is_scalar($comment) || $comment instanceof \Stringable ? (string) $comment : '';
    }

    /**
     * Whether the notice applies to the scope being edited
     *
     * @param AbstractElement $element
     * @return bool
     */
    protected function isShown(AbstractElement $element): bool
    {
        return true;
    }
}
